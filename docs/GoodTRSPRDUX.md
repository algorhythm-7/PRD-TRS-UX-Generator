# What makes a good PRD, TRS, and UX Design document

Research-grounded reference used to write and improve this app's LLM prompts
(`app/server.mjs` / `app/vite.config.ts`) and the deterministic fallback generators
(`app/src/generation/{prdGen,trsGen,uxGen}.ts`). Mapped directly onto this app's existing,
unchanged section names — this is a content-quality guide, not a proposal to change the
document structure.

**Sources** (fetched and reviewed directly, not from memory):
- Atlassian, ["How to create a product requirements document (PRD)"](https://www.atlassian.com/agile/product-management/requirements)
- ProductPlan, ["Product Requirements Document" glossary](https://www.productplan.com/glossary/product-requirements-document/)
- Wikipedia, ["Software requirements specification"](https://en.wikipedia.org/wiki/Software_requirements_specification) (summarizing IEEE 830 and its successor, ISO/IEC/IEEE 29148:2018)
- Nielsen Norman Group, ["Journey Mapping 101"](https://www.nngroup.com/articles/journey-mapping-101/)
- Nielsen Norman Group, ["10 Usability Heuristics for User Interface Design"](https://www.nngroup.com/articles/ten-usability-heuristics/)

---

## 1. PRD (Product Requirements Document)

Sections used by this app, in order: **Problem Statement, Business Case, Proposed Solution,
Functional Requirements, User Personas and their Journey, Exclusions, Success Criteria,
Assumptions, Risks and Dependencies.**

### What "good" looks like, per section

- **Problem Statement** — states a real, specific user/business pain, not a restatement of the
  solution. Should answer "who hurts, how, and why does it matter now" — per Atlassian, this is
  the "background and strategic fit" a PRD needs before anyone reads a single feature.
- **Business Case** — ties the problem to measurable value (cost saved, revenue protected, risk
  reduced, time saved) for a specific stakeholder group. Avoid vague claims like "creates value" —
  a good business case names *who* benefits and *how the benefit will be observed*.
- **Proposed Solution** — a concise description of the approach, not an implementation spec
  (ProductPlan: a PRD "may not dictate a specific implementation"). Should be readable by a
  non-technical stakeholder.
- **Functional Requirements** — the core of the document (ProductPlan: "must include every
  explicit capability required"). Good functional requirements are individually **necessary,
  unambiguous, and testable** (this exact phrasing is IEEE/ISO 29148's requirement-quality
  standard, and it transfers cleanly to product requirements too) — each one should be phrased as
  a capability the system *shall* provide, not a design detail. Group related capabilities; avoid
  one giant undifferentiated paragraph.
- **User Personas and their Journey** — a specific actor (not "a user"), a goal, and enough of a
  journey/scenario to justify why the requirements above matter (see the UX section below for the
  same principle in more depth). Weak version: "a user who needs the product." Good version:
  names a role, a trigger, and an outcome.
- **Exclusions** — explicit "what we're not doing" (Atlassian's term for this exact PRD section).
  This is not filler — a good exclusions section prevents scope creep by naming specific
  capabilities considered and deliberately deferred, not just a generic disclaimer.
- **Success Criteria** — measurable, ideally with a number or an observable signal (adoption rate,
  task completion, time saved, error rate). Avoid restating the problem statement as "success."
- **Assumptions** — per ProductPlan, "anything you expect to be in place, yet isn't guaranteed"
  (e.g., connectivity, an existing account system, a data source). Distinguish from Exclusions —
  assumptions are about pre-conditions, not scope.
- **Risks and Dependencies** — per ProductPlan, dependencies are specific external systems/teams
  the product relies on; risks should each name a plausible failure mode, not just "things could
  go wrong."

### Anti-patterns to avoid (all sections)

- Generic, could-apply-to-any-product language (a strong smell test: could you swap the product
  name for a different product and have the sentence still make sense? If yes, it's too generic).
- Restating the input verbatim instead of synthesizing/elaborating on it.
- Vague quantifiers ("many," "most," "significantly") without any actual number, threshold, or
  observable signal.

---

## 2. TRS (Technical Requirements Specification)

Sections used by this app: **Summary, Problem Statement and Proposed Solution, High Level
Architecture, System Boundaries, Non-Functional Requirements, Data Requirements, Integration
Requirements, UI Requirements, Test and Validation, Risks and Dependencies, Deployments, AI Usage
and Implications.**

This app's TRS is a lighter-weight cousin of a formal SRS, but the same standards apply where
they're relevant. ISO/IEC/IEEE 29148:2018 (which superseded IEEE 830 in 2011, per its own
Wikipedia-documented history) is the authoritative reference for requirements engineering; its
structure and quality bar map onto this app's sections as follows.

### What "good" looks like, per section

- **Summary** — a short technical abstract: what the system is, and what problem it solves,
  written for an engineering audience (assume more context than the PRD's Problem Statement).
- **Problem Statement and Proposed Solution** — the technical framing of the same problem the PRD
  describes, but stated as an architectural/engineering challenge, with the proposed approach
  named at a component level (not implementation-level pseudocode).
- **High Level Architecture** — should name the actual components/layers and how they communicate
  (client, service, data store, external integrations) — the standard's "product perspective" and
  "system interfaces" sections cover exactly this. Avoid generic "the system uses a web
  architecture" filler; be specific to what was actually described in the input.
- **System Boundaries** — explicitly state what's in scope of *this* system vs. what's an external
  dependency/actor — this is IEEE/ISO 29148's "system interfaces" and "design constraints" idea:
  a good boundary statement lets a reader know exactly where responsibility starts and stops.
- **Non-Functional Requirements** — ISO/IEC/IEEE 29148 explicitly enumerates the standard
  categories: **reliability, availability, security, maintainability, portability**, plus
  performance. A good NFR section addresses each *relevant* category concretely (e.g., "the system
  shall respond to X within Y seconds" is testable; "the system shall be fast" is a requirement
  smell per the standard's own terminology).
- **Data Requirements** — what data is created/read/stored, and its sensitivity — should reflect
  the "logical database requirement" and "memory constraints" categories from the standard, scaled
  down appropriately for the described product.
- **Integration Requirements** — name the actual external systems/APIs implied by the input (per
  "external interface requirements" / "software interfaces" in the standard) — avoid a generic
  "integrates via JSON API" unless nothing more specific was given.
- **UI Requirements** — from the standard's "user interfaces" category — should describe what the
  interface needs to support functionally (not visual design, which belongs in the UX document),
  e.g., which views/roles/states are needed.
- **Test and Validation** — the standard recommends this section "mirror the structure of specific
  requirements" — i.e., a good Test and Validation section should reference *how* the functional
  and non-functional requirements above will be verified, not just list generic test types.
- **Risks and Dependencies** — technical risks (integration reliability, data quality, third-party
  API stability) distinct from the PRD's business-level risks.
- **Deployments** — how the system is packaged/shipped/operated — concrete to what was described
  (a web app vs. a mobile app vs. an embedded system implies very different deployment needs).
- **AI Usage and Implications** — this is a section unique to this app (not in the classic
  standard) — should describe whether/how AI/ML is used in the product being *specified* (not this
  generator's own AI usage) and any resulting implications (data handling, explainability,
  fallback behavior) if the input implies any AI-driven capability; otherwise state plainly that
  none is used.

### Requirement-quality checklist (from ISO/IEC/IEEE 29148, applies across all TRS sections)

A good individual requirement is: **necessary, appropriate, and unambiguous.** A good *set* of
requirements is: **complete, consistent, feasible, and comprehensible.** The standard explicitly
names "requirement smells" to avoid: subjective language, ambiguous adverbs/adjectives,
superlatives, negative statements ("shall not" without a testable positive alternative),
comparative phrases, non-verifiable terms, and words implying totality ("always," "never," "all")
without justification.

---

## 3. UX Design Mockups

Segments used by this app: **User Journeys for personas, UI Design Mockups.**

### User Journeys for personas

Nielsen Norman Group's journey-mapping framework identifies five components every good journey
needs — this app's output should include all five, even in a condensed textual form:

1. **Actor** — a specific persona, not a generic "user." NN/g: "provide one point of view per
   map" — if multiple personas are relevant, give each their own distinct journey rather than
   blending them into one generic narrative.
2. **Scenario + Expectations** — the specific situation/goal driving the journey, and what the
   persona expects to get out of it.
3. **Journey Phases** — high-level stages appropriate to the product (NN/g gives examples like
   discover → try → buy → use → seek support for e-commerce, or purchase → adoption → retention →
   expansion → advocacy for B2B tools) — should be chosen to fit the specific product described,
   not a copy-pasted generic four-step list.
4. **Actions, Mindsets, and Emotions** — what the persona actually does at each phase, plus their
   thoughts/motivations and emotional state (NN/g: "not meant to be a granular step-by-step log...
   rather a narrative of the steps"). This is the single biggest lever for making a journey feel
   real instead of generic — include at least *some* indication of what the persona is thinking or
   feeling, not just a bulleted list of clicks.
5. **Opportunities** — what the journey reveals about where the product should focus (NN/g: "how
   the user experience can be optimized").

### UI Design Mockups

This app renders mockups as text/ASCII-art wireframes (not real images), so "good" here means:

- Structurally represent the actual screens/views implied by the functional requirements (not a
  single generic screen reused for every product).
- Apply Nielsen's usability heuristics as a *content* checklist even in a text wireframe — most
  directly:
  - **Visibility of system status** — show where loading/progress/confirmation feedback appears.
  - **Match between system and the real world** — use terminology from the product's own domain,
    not generic placeholders.
  - **User control and freedom** — indicate an obvious way to cancel/undo/go back.
  - **Consistency and standards** — reuse the same layout patterns across described screens.
  - **Error prevention / recognition rather than recall** — call out where the interface surfaces
    needed information/options directly, rather than requiring the user to remember something
    from an earlier screen.
  - **Aesthetic and minimalist design** — the mockup should show only what's needed for the
    described core flows, not an exhaustive kitchen-sink screen.
- Each mockup should map back to a journey phase or functional requirement described elsewhere in
  the generated documents, so a reviewer can trace "why does this screen exist."

### Anti-patterns to avoid (UX)

- A single, generic "new user onboarding" journey used regardless of what the product actually
  does (the exact weakness of this app's own deterministic fallback content — acceptable as a
  last-resort fallback, but the LLM path should always do meaningfully better).
- Wireframes that are just a restatement of the input form's own fields, rather than a mockup of
  the *actual product being specified*.

---

## 4. How this maps to the app's LLM prompts

Both the gap-analysis prompt and the generate prompt (in `app/server.mjs` and
`app/vite.config.ts`, kept in sync) now reference this document's standards directly:

- The **generate** system prompt is parameterized per `docType` and names the specific quality bar
  above for that document type (testable/unambiguous requirements for TRS; specific
  personas/journeys for PRD and UX; the five journey-mapping components and usability heuristics
  for UX) instead of one generic "write clear, specific, professional content" instruction.
- The **gap-analysis** prompt is instructed to identify missing information *specifically because*
  it's needed to satisfy the standards above (e.g., missing NFR categories, missing persona
  detail, missing measurable success signals) rather than asking generic clarifying questions.
- Both prompts explicitly request clean, valid Markdown body text (using `###` for any
  sub-headings so it nests correctly under this app's own `##` section heading, proper blank
  lines around lists, and no stray/malformed heading syntax), since the app now renders the
  output as Markdown (see `OutputView.tsx`) instead of showing raw text.
