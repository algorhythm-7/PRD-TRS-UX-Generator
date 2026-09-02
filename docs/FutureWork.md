# SpecPilot — Future Work: Expert Evaluation & Strategic Roadmap

**Purpose of this document.** This is not a backlog and not a sprint plan. It is a comprehensive,
expert-level evaluation of SpecPilot in its current, as-built state, plus a 12–24 month roadmap for
how it should evolve. It is written for whoever inherits this project next — architects,
engineering managers, product managers, UX designers, and AI engineers — so they can understand
not just *what* exists today, but *why* it was built this way, what its ceiling currently is, and
what a deliberate, sequenced investment plan to raise that ceiling looks like.

Every claim about the current system in this document is grounded in the actual, verified
implementation (see `docs/DeveloperDocs.md` for the full technical reference this evaluation is
built on) — nothing below describes aspirational behavior as if it already existed.

---

## Section 1: Executive Assessment

### Current Ratings (1 = early prototype, 5 = enterprise-grade, mature)

| Dimension | Rating | Summary |
|---|---|---|
| Product | 3/5 | A genuinely useful, coherent single-user workflow with real differentiation (multi-format generation, human-in-the-loop feedback). Missing the collaboration/governance layer any real organization will eventually need. |
| Engineering | 3/5 | Clean, well-organized, well-tested for a single-developer-scale codebase. Held back by one structural constraint (server/dev logic duplication) and several "acceptable fragility" heuristics accepted as deliberate trade-offs early on. |
| Architecture | 3/5 | Sound for its current scale (single Express process, no database, no queue) — but has no persistence layer, no multi-user concept, and no observability stack, which will all become blocking issues the moment this needs to serve more than one person's browser. |
| UX | 3/5 | The core generation loop (input → profile → generate → edit → regenerate) is coherent and was recently improved (hover-preview, disabled-state clarity for dependent controls). Still has real gaps: silent upload outcomes, no diffing on regeneration, no AI-reasoning transparency, and a profile screen that exposes a large number of controls with limited progressive disclosure. |
| AI Capability | 3/5 | The prompt-construction system is unusually thorough and well-documented for its class (per-DocType guidance, 9 named formats, EARS phrasing, traceability, compliance framing, innovation-assistance-linked temperature). It has zero evaluation/quality-scoring infrastructure, no retrieval system beyond raw text concatenation, and no learning loop beyond simple recency-weighted preference voting. |
| Enterprise Readiness | 2/5 | No authentication/authorization concept, no multi-tenant or multi-user data model, no audit trail, no admin controls, and all "memory" lives in a single browser's local storage. This is the single largest gap between where the product is and where it would need to be to sell into a regulated or multi-team enterprise context. |

### Strengths (elaborated in Section 2)
A genuinely thoughtful generation pipeline: per-DocType configuration, 9 real named document
formats (not just cosmetic labels — each has its own section skeleton *and* its own prompt
guidance), a working human-in-the-loop regeneration loop, and a lightweight, honestly-scoped
session-memory system that learns user preference over time without over-promising what it
remembers.

### Weaknesses
The product has no concept of a "user" beyond a single browser's local storage — nothing is
shared, nothing is centrally governed, nothing is auditable. The AI layer has real sophistication
in prompt construction but zero measurement of whether that sophistication actually produces
better documents — there is no scoring, no evaluation harness, and no systematic way to detect
regressions in generation quality when a prompt is changed. Architecturally, the deliberate
decision to make the production server a single self-contained file (to satisfy a narrow Docker
build constraint) has calcified into full logic duplication between the dev and prod code paths —
a real, compounding maintenance cost that will only get worse as more capability is added.

---

## Section 2: Current Strengths

These are capabilities that are genuinely well-built and should be preserved and built upon, not
replaced, as the system evolves.

**Session memory (client-side, `localStorage`-backed).** A recency-weighted "consolidation" vote
over the last 20 generations, used to pre-fill the Generation Profile screen — with an honest
confidence/conflict signal shown to the user when past choices were genuinely mixed, rather than
silently picking a winner. This is a real, working example of a system that learns from usage
without over-claiming: it doesn't pretend to understand *why* a user prefers a setting, it just
observes and adapts. This pattern (observe → weight by recency → surface confidence, not just a
value) is worth carrying forward into any future server-side preference system.

**Human-in-the-loop regeneration.** The edit → comment → per-section keep/rewrite → regenerate
loop is a real differentiator against a naive "regenerate the whole thing" pattern common in AI
document tools. Critically, it distinguishes sections the user wants preserved from sections they
want rewritten, and it honestly surfaces the case where a fallback occurred and the user's
feedback could *not* be incorporated, rather than silently pretending it was.

**Generation Profiles with true per-format behavior.** The 9 named document formats are not
cosmetic — each drives both a distinct section skeleton and a distinct, detailed prompt-guidance
paragraph, and this was independently, empirically confirmed (not just read from code) to produce
genuinely different, format-appropriate output. This is a rare level of rigor for what is often, in
competing tools, a purely cosmetic "style" selector.

**Custom templates with genuine per-DocType isolation.** A user can upload a completely different
structural template for PRD vs. TRS vs. UX in the same session, and each is used exactly as
provided — no silent renaming, no forced merging with a built-in structure.

**Clarification (gap-analysis) workflow.** Asking up to five targeted follow-up questions *before*
committing to a full generation, with a graceful, invisible failure mode (any clarification
failure is treated as "no questions" rather than blocking the user), is a mature pattern that
balances quality against user friction.

**History system.** A local, per-browser, expandable audit trail of every generation's exact
configuration (not just a vague "recent projects" list) — genuinely useful for a returning user
trying to remember "what did I pick last time."

**Calypso (internal LLM cluster) integration resilience.** Racing multiple candidate models in
parallel, a two-attempt structured-then-plain-JSON retry strategy per candidate, explicit
context-limit detection in error messages, and a deterministic offline fallback so the product
*never* produces literally nothing — this is a notably more resilient integration pattern than a
single-model, single-attempt call, and reflects real operational lessons learned (the code's own
comments describe specific, previously-observed failure modes this design was built to survive).

---

## Section 3: Current Limitations

Each limitation below is stated as observed fact, with its business impact.

**Prompt-only preference learning.** Everything the system "remembers" is a recency-weighted vote
over discrete setting values (format, mode, depth, etc.) — there is no learning from the *content*
of edits, no semantic understanding of *why* a user rewrote a section, and no cross-user learning
at all (each browser starts from zero). *Business impact:* the system can tell you "you usually
pick Volere for PRDs," but it can never tell you "your organization's PRDs usually need a stronger
security section" — the highest-value learning signal (what users actually change) is captured only
as a raw count, never analyzed.

**Limited traceability.** Requirement IDs are assigned fresh by the model on every single
generation call, with no persisted registry, no guaranteed stability across regenerations, and no
structured parent-child data model — any "CRS-PRD-003 → TRS-014" relationship that appears in
output is free text the model wrote, not a verified, queryable link. *Business impact:* this makes
the traceability feature effectively cosmetic for any workflow that requires audit-grade,
change-tracked requirement lineage (a common requirement in regulated industries).

**Missing analytics.** There is no aggregate view of usage anywhere — no way to answer "which
formats are most used," "which document types get the most edits/rewrites," or "where does the
fallback path trigger most often." All of this data technically exists (per-generation records),
but only ever in a single, unindexed local array. *Business impact:* product and engineering
decisions about what to improve next currently have to rely on anecdote rather than evidence.

**Upload UX gaps (partially closed).** Reference-document and style-example uploads now show a
confirmation message on success (a preview of each uploaded document, mirroring the Custom
Template pattern). What remains open: no confirmation of *extraction quality* itself (e.g. a
`.pdf` that extracted to an empty string still shows an empty preview with no explicit warning),
and no surfaced indication when a document was silently truncated at the character limit.
*Business impact:* the most acute trust gap ("did anything happen at all?") is resolved; the
remaining gap is lower-severity (misleading silence about *quality*, not *whether it ran*).

**PDF extraction limitations.** PDF support for reference documents routes through a multimodal
chat-completion call that is explicitly unverified against real-world PDFs in the codebase's own
documentation, and PDF isn't accepted at all for custom templates. *Business impact:* a common,
expected file type is either unsupported or unreliable, which will surface as user frustration the
moment PDF is the only format a user has on hand.

**Lack of performance instrumentation.** There is no latency tracking, no success/failure-rate
metrics, no token-usage tracking, and no dashboards anywhere in the system — the only visibility
into generation health is unstructured console log lines. *Business impact:* if generation quality
or latency degrades in production, there is currently no way to detect that except a user
complaint.

**Missing admin controls.** There is no way for anyone to configure default settings
organization-wide, enforce a mandatory template/format, review what's being generated, or disable a
misbehaving model candidate without a code deployment. *Business impact:* this blocks any
multi-team or multi-department rollout, since every team would need to independently discover and
configure the same settings with no shared source of truth.

**Limited collaboration features.** Nothing about a generation, a profile, or an edit is shareable
between users — session memory, history, and reference documents are all trapped in one person's
browser. *Business impact:* the product cannot currently support the common enterprise pattern of
"one person drafts, a team reviews and iterates together."

---

## Section 4: Product Evolution Roadmap

Prioritized by a blend of user value, engineering effort, and enterprise-adoption impact — earlier
phases favor high-value, lower-effort wins; later phases tackle structural, higher-effort
investments.

### Phase 1 (1–3 months) — Close the trust gaps, add measurement
- ~~Fix upload-confirmation UX (reference documents, style examples)~~ — **done**: both now show
  a confirmation with a text preview. Remaining, lower-priority follow-up: surface the
  `truncated` flag and warn when extraction produced suspiciously little text.
- Surface the `truncated` flag from context extraction so users know when a document was cut off.
- Add basic, structured backend logging/metrics for generation success rate, latency, and
  fallback-trigger frequency (no dashboard needed yet — just structured, queryable log output).
- Root-cause and fix the observed session-history thumbs-down-count discrepancy.
- Verify PDF reference-document extraction against real-world PDFs and fix or clearly gate the
  feature based on what's found.

### Phase 2 (3–6 months) — Make the AI layer measurable
- Stand up a lightweight generation-quality evaluation harness (even a manually-curated set of
  test products with expected-quality checks) so prompt changes can be validated against a
  baseline instead of "it looked fine when I tried it."
- Add a structured feedback-mining pipeline: aggregate what gets edited/rewritten most often across
  all generations, to identify systematically weak sections/formats.
- Introduce a persisted requirement-ID registry so IDs survive regeneration for a given document
  session, laying groundwork for real traceability.
- Begin de-duplicating the server.mjs/vite.config.ts logic split (see Section 13) — this is a
  compounding cost that gets more expensive to fix the longer it's deferred.

### Phase 3 (6–12 months) — Move from single-user to team-ready
- Introduce a real backend data store (today there is none — everything is either stateless or
  browser-local) so profiles, history, and reference material can be centrally stored.
- Add basic multi-user support: authentication, per-user history, and the ability to share a
  Generation Profile or a generated document with a teammate.
- Build a Company Standards Library (Section 7) so an organization can pre-configure its preferred
  templates/formats/compliance framing once, rather than every user rediscovering the same
  settings.
- Add a real evaluation/regression-testing framework for prompt changes (formalizing Phase 2's
  harness into an actual CI gate).

### Phase 4 (12+ months) — Enterprise-grade platform
- Full traceability graph: persisted requirement relationships, dependency visualization, and
  change-impact analysis across regenerations (Section 8).
- Governance layer: approvals, versioning, audit trail, and admin controls (Section 9).
- Advanced AI capabilities: retrieval-augmented generation over a real document corpus, automated
  quality scoring, and continuous preference-learning that goes beyond simple recency-weighted
  voting (Section 5).
- Requirement Coverage Analysis and a Session Learning Dashboard (Section 7) as flagship
  differentiators for enterprise buyers.

---

## Section 5: AI & Generation Improvements

### Prompting
Current state: a single, carefully layered system-prompt assembly (base → DocType guidance →
format guidance → phrasing overlay → mode → audience → depth/decomposition → traceability →
assumption strategy → compliance → output structure → reference content → innovation assistance).
This is genuinely mature *as a template system* — but it is entirely static: every guidance string
is hand-authored and never adjusted based on measured outcomes. A mature system would treat prompt
fragments as versioned, independently-testable units, with automated evaluation gating any change
to a fragment before it ships (see "Evaluation framework" below).

### Context assembly
Current state: reference documents are concatenated as flat text, explicitly framed as
"non-authoritative background," with a fixed per-document character cap and a fixed maximum of
three documents, applied identically to every document type in the batch. There is no ranking, no
relevance filtering, and no way to scope a reference document to only the document type it's
actually relevant to. A mature architecture would (a) chunk and rank reference material by
relevance to the specific document type being generated rather than sending everything to
everyone, and (b) support many more reference documents than three by making inclusion
relevance-driven rather than a hard cap.

### Generation quality
Current state: quality is entirely a function of prompt engineering plus the underlying model's own
capability — there is no automated signal, anywhere in the system, that indicates whether a given
generation was actually *good*. A mature system needs an evaluation framework (below) as a
prerequisite for any confident, data-driven prompt iteration.

### Regeneration quality
Current state: genuinely good design (see Section 2) — but has no measurement of whether a
regeneration actually satisfied the user's stated feedback, beyond the user's own implicit
signal of not regenerating again. A mature system would track "was this the last regeneration for
this document" as an implicit satisfaction signal and mine it.

### Preference learning
Current state: a simple recency-weighted majority vote over discrete setting values, with no
semantic content involved at all (see Section 3). A mature preference-learning system would go
further in two directions: (1) **preference summarization** — periodically distill "why" a user's
choices trend a certain way into a short, human-readable profile (e.g. "this user consistently
prefers Compliance-Grade depth and ISO 26262 framing for TRS documents") that could itself become
context for future generations; (2) **learning from edits**, not just settings — mining the actual
diff between generated and user-edited content to detect systematic weaknesses (e.g. "Non-
Functional Requirements sections are rewritten from scratch 40% of the time" is a much stronger
signal than any setting-level vote).

### Document/template understanding
Current state: template extraction is a single, unstructured "extract section names" call with no
validation of the result's sanity (an empty or duplicate-laden list would flow straight through
unmodified). A mature system would validate extracted structure (non-empty, no duplicates,
reasonable length) and could additionally extract a short structural *summary* of each section's
apparent purpose from the source document, not just its name, to better inform generation.

### Hallucination reduction
Current state: relies entirely on prompt instructions ("do not invent...", "use the description
provided...") with the Assumption Strategy control as the only explicit lever, and no post-hoc
verification of any kind. A mature system would add a lightweight self-consistency or citation-
style check — e.g. asking the model to flag which statements are drawn from user input vs.
inferred, and surfacing that distinction in the UI (this pairs naturally with "AI reasoning
transparency" in Section 6).

### Evaluation framework (the single most important AI-layer gap)
There is currently **no** automated way to answer "did this prompt change make output better or
worse?" A mature evaluation framework would include:
- A fixed, versioned set of representative test products (varying in domain, completeness, and
  ambiguity) run through generation on every meaningful prompt change.
- **Quality scoring**: an automated rubric (even a secondary LLM-as-judge pass) checking for
  requirement-quality smells the prompts already explicitly warn against (vague language, missing
  measurable criteria, generic personas) — turning today's prompt instructions into testable
  assertions instead of hopeful requests.
- **Automated evaluation** integrated into the same test suite that already exists for
  deterministic code, so a prompt regression is caught the same way a code regression would be.
- **Feedback mining**: systematically aggregating real edit/thumbs-down data (once persisted
  centrally — see Section 4 Phase 3) as an additional, real-world quality signal alongside
  synthetic evaluation.
- **Context ranking**: once reference-document volume grows past the current 3-document cap, a
  relevance-ranking step becomes necessary rather than optional.

### RAG opportunities
The current reference-document system is context-stuffing, not retrieval — every uploaded
document's full (truncated) text is sent every time, regardless of relevance to the specific
section being written. A genuine RAG layer (chunk, embed, retrieve top-K relevant chunks per
section being generated) would allow supporting far more reference material than three short
documents, and would improve precision by only surfacing the parts of a reference document
actually relevant to, say, the Non-Functional Requirements section rather than the whole document
undifferentiated.

---

## Section 6: Frontend & UX Improvement Plan

### Navigation
The current flow (Input → Profile → Clarify → Output) is linear and easy to follow for a first-
time user, but there is no persistent sense of "where am I in this process" — no step indicator,
no ability to jump back to an earlier step without starting over. **Quick win:** a simple step
indicator ("Step 2 of 3: Configure").

### Discoverability
Several genuinely valuable features are easy to miss entirely: the hover/focus format preview, the
per-DocType isolation of custom templates, and the fact that reference documents are shared across
*all* selected document types are all things a first-time user would likely never discover without
reading documentation. **Quick win:** a first-run tooltip tour or a single "what's new"/"tips"
affordance highlighting the top 2–3 non-obvious capabilities.

### Cognitive load
The Generation Profile screen, once expanded for 2–3 document types, presents a genuinely large
number of simultaneous controls (6 per-DocType settings × N document types, plus 4 shared
sections). **Medium-sized improvement:** progressive disclosure — collapse each per-DocType panel
to just Template + Generation Mode by default, with an "Advanced settings" expander for Depth/
Decomposition/Innovation/Audience, since most users likely only need the top-level controls most
of the time.

### Workflow design
The two-step Input → Profile flow (rather than one long form) is a good design decision, but the
"Continue" button leaves the original Input form still visible below the newly-revealed Profile
screen, which can read as a rendering glitch rather than an intentional layered UI. **Quick win:**
either visually collapse/gray out the completed Input step, or make the transition feel more like
a wizard with clear step boundaries.

### Error handling
Errors are currently handled inconsistently: some failures show a clear message (validation
errors, the "couldn't read your template" message), while others fail completely silently (gap-
analysis failures, reference-document upload failures beyond the shared generic error text).
**Medium-sized improvement:** a consistent error-and-recovery pattern across every async action in
the app, always distinguishing "this genuinely failed" from "this used the offline fallback" from
"nothing bad happened, there was just nothing to report."

### Feedback systems
The thumbs-up/down + comment regenerate flow is a strong pattern (Section 2), but it currently only
exists at the end of a generation, not during. **Major redesign opportunity:** a lighter-weight,
inline feedback affordance directly in the Preview pane (e.g. a small icon next to each heading)
rather than requiring the user to first click "Regenerate with my edits" to reveal per-section
controls.

### Visual hierarchy
The app currently uses a single dark theme with fairly uniform visual weight across form controls,
alerts, and buttons. **Quick win:** stronger visual differentiation between primary actions
(Generate, Confirm regenerate) and secondary/destructive ones (Clear my learned preferences),
which today are visually similar.

### Accessibility
Labels and `aria-label`s are used consistently and thoughtfully throughout — this is a genuine
strength, not a gap. The main accessibility opportunity is around dynamic content: newly-revealed
sections (clarification questions, regenerate confirm UI, format preview) don't currently announce
themselves to screen readers via live regions. **Medium-sized improvement:** `aria-live` regions
for these dynamically-appearing blocks.

### Prioritized improvement list

**Quick wins:** step indicator; ~~upload success/failure confirmations (also listed in Section
3)~~ **(done)**;
visual differentiation of destructive actions; first-run tips/tour.

**Medium-sized improvements:** progressive disclosure on the Generation Profile screen; consistent
error-handling pattern; `aria-live` regions for dynamic content; a richer History view (see below).

**Major redesign opportunities:** inline, always-available per-section feedback (not gated behind
"Regenerate with my edits"); a genuine diff view showing exactly what changed between the previous
and regenerated version of a document (today, a regenerated document simply replaces the old one
with no way to compare); AI reasoning transparency — a lightweight explanation of *why* the model
made a particular choice (which assumption strategy/innovation level was applied, what reference
material it actually drew from), addressing the current "black box" feel of generation.

---

## Section 7: Advanced User Experience

For a best-in-class enterprise experience, the following capabilities would move SpecPilot from
"a good personal tool" to "a platform teams standardize on":

**Saved Generation Profiles.** Let a user explicitly name and save a full profile configuration
(not just have it implicitly learned via recency-weighted voting) — e.g. "Automotive Safety TRS"
as a one-click starting point for a whole class of future documents.

**Shared Team Profiles.** The natural extension of the above: profiles a team lead configures once
and every team member can select, ensuring consistency without everyone re-discovering the same
settings independently.

**Company Standards Library.** A curated, organization-controlled set of preferred
templates/formats/compliance framing defaults — the natural next step once Shared Team Profiles
exist, aimed at ensuring every document produced across an organization defaults to the same
standard unless explicitly overridden.

**Template Marketplace.** A place to browse, preview (using the same hover-preview mechanism
already built for named formats), and adopt community- or organization-contributed custom
templates, rather than every user having to author and upload their own from scratch.

**AI Output Comparison Mode.** Generate the same document under two different profiles (e.g. two
different Templates, or two different Innovation Assistance levels) side-by-side, to help a user
actually decide between options rather than guessing from the static hover-preview alone.

**Requirement Explorer.** A structured, filterable view over every requirement across every
generated document in a project — searchable by keyword, filterable by document type, and
(once traceability IDs are persisted — Section 8) navigable by which requirements map to which.

**Traceability Explorer.** A visual graph of CRS→TRS→verification relationships, rather than the
current free-text "fulfills CRS-PRD-003" style references embedded in prose.

**Session Learning Dashboard.** Surface what the system has learned about a user's (or a team's)
preferences in an explicit, reviewable way — turning today's invisible recency-weighted vote into
something a user can see, understand, and manually correct if it's learned the wrong thing.

**Requirement Coverage Analysis.** Automated cross-checking of whether every PRD requirement has a
corresponding TRS requirement (and vice versa) when both are generated together — surfacing gaps
before a human reviewer has to find them manually.

---

## Section 8: Traceability & Requirements Engineering

**Current state, honestly assessed:** traceability today is entirely a *prompt instruction*, not a
data feature. "Generate requirement IDs" asks the model to invent IDs following a naming
convention; "CRS → TRS mapping" and "Verification references" ask it to reference those invented
IDs in free text. Nothing about this is validated or persisted — a regeneration can still
plausibly assign an entirely different ID to what a human would consider "the same" requirement,
though a prompt-level mitigation now instructs the model, during a regeneration, to reuse any IDs
it can see in the user's already-edited version rather than reassigning fresh ones. This raises
the odds of practical stability in the common case but is explicitly a best-effort mitigation, not
a guarantee — there is still no registry that validates or enforces it.

**Full requirement IDs (persisted).** The first real structural investment needed: an ID registry
that survives across a document's edit/regenerate lifecycle, so "TRS-014" means the same
requirement today as it did after three regenerations, with actual validation rather than a hopeful
prompt instruction. This is a prerequisite for everything else in this section.

**Relationship graphs.** Once IDs are stable, the free-text "fulfills CRS-PRD-003" pattern can be
replaced with an actual structured relationship record — enabling querying ("show me every TRS
requirement that doesn't map to any PRD requirement") that free text can never reliably support.

**Dependency visualization.** A visual graph (not a document skim) showing which requirements
depend on which others — valuable the moment a document has more than a handful of requirements,
which is essentially always.

**Verification linkage.** Connecting each requirement to the specific test/validation approach that
verifies it, structurally rather than as embedded prose in the Test and Validation section —
enabling a genuine coverage report ("which requirements have no linked verification approach?").

**Requirement hierarchy views.** A structural view respecting the chosen Requirement Decomposition
level (Feature → Sub-System → Component → Signal/Interface) as an actual navigable tree, rather
than flat prose at whichever single level was chosen for that generation.

**Change impact analysis.** Once IDs and relationships are persisted, regenerating or editing one
requirement should be able to surface "these N other requirements reference this one — are they
still accurate?" — turning today's fully manual review burden into a guided one.

**Why this matters:** traceability is the single feature area with the clearest path to genuine
enterprise differentiation (Section 14) — it's also the area furthest from being real today, since
every piece of it currently lives entirely in free text the model generates fresh each time.

---

## Section 9: Enterprise Features

**Security.** No authentication exists today — the application has no concept of a logged-in user
at all. Any enterprise deployment needs, at minimum: user identity, and scoping of history/
profiles/reference material to that identity rather than a shared browser.

**Compliance.** Compliance Framing (ASPICE/ISO 26262) today only changes prompt wording — it makes
no claim about, and provides no support for, an actual compliance audit trail. A genuine
compliance capability would need versioned, timestamped records of exactly what was generated,
under what configuration, and by whom.

**Administration.** No admin surface exists for configuring organization-wide defaults, restricting
which formats/models are available to which users, or reviewing usage. This is a hard blocker for
any multi-team rollout (also noted in Section 3).

**Governance.** No approval workflow exists — a generated document goes straight from "generated"
to "exported," with no concept of a review/sign-off step before a document is considered final.

**Auditability.** Today's only "audit trail" is the local, per-browser session history — not
exportable, not centrally reviewable, and trivially erasable by the "Clear my learned preferences"
button (which, notably, also deletes the entire history, not just consolidated preferences — a
naming/scope mismatch worth fixing regardless of the larger governance question).

**Approvals.** A structured "submit for review → approved/rejected → locked" state machine around
a generated document, mapping naturally onto how PRDs/TRSs are actually signed off in most
organizations today.

**Version control.** Every regeneration today fully replaces the prior version with no history of
intermediate versions — there is no way to see "what did this document look like before the third
regeneration?" A genuine version history (not just the current single-snapshot replacement model)
is foundational to almost every other enterprise feature listed here.

**Multi-user collaboration.** The most structurally significant gap: nothing about a document,
profile, or piece of context is shareable between two people today. Real collaboration (co-editing,
commenting, shared review) requires the backend data store called out in Section 4 Phase 3 as a
prerequisite.

**Implementation note:** every item in this section shares one real prerequisite — a persisted,
server-side data store with a concept of users and documents, replacing today's stateless-
generation-plus-browser-local-storage model. This should be treated as the single foundational
architecture investment that unlocks the rest of this section, not as 8 independent features to
build in parallel.

---

## Section 10: Document Intelligence Improvements

**Current template uploads.** Solid for what they do (extract a section-name list from a `.txt`/
`.md`/`.docx` file) but shallow — no validation of the extracted list's sanity, no understanding of
*what each section is for* beyond its name, and no `.pdf` support at all.

**Reference document uploads.** Functionally proven to work (verified: uploaded content genuinely
appears in generated output), but capped at 3 documents with no relevance ranking, and with the
UX gap already noted (no upload confirmation).

**PDF extraction.** The weakest link today — routed through an unverified multimodal chat call for
reference documents, and not supported at all for templates. This needs to be either properly
verified and hardened, or replaced with a purpose-built OCR/PDF-parsing approach if the current
multimodal-chat method proves unreliable at scale.

**DOCX support.** Solid — handled entirely client-side with no server round-trip, a genuinely good
design choice for cost/latency.

**Recommendations:**
- **Better extraction:** validate every extraction result (non-empty, sane length, no obvious
  duplication) before accepting it, for both templates and reference content.
- **Multi-document reasoning:** today, multiple reference documents are simply concatenated; a
  more capable system would allow the model (or a pre-processing step) to reconcile/cross-
  reference facts across documents, flagging contradictions rather than silently including both.
- **Structured ingestion:** move from "extract raw text" to "extract a lightweight structure"
  (headings, lists, tables) so downstream generation can reason about a reference document's own
  organization, not just its undifferentiated text.
- **Metadata extraction:** capture and surface basic metadata (upload date, file type, extracted
  length, truncation status) alongside reference content, closing the "did this even work" gap
  from Section 3/6 with real information, not just a checkmark.
- **Image/diagram understanding:** entirely absent today — architecture diagrams, wireframes, or
  screenshots embedded in an uploaded reference document are invisible to the system. This is a
  natural extension of the multimodal capability already partially wired up for PDF extraction.
- **Document indexing:** once reference material volume grows (Template Marketplace, Company
  Standards Library — Section 7), a real index/search layer becomes necessary instead of a flat,
  per-session, 3-document cap.

---

## Section 11: Performance & Scalability

**Frontend.** A standard single-page React app with no unusual performance concerns today — the
main latency the user experiences is entirely generation latency, not rendering. No specific
frontend performance work is urgent yet, but this should be revisited once History/Requirement
Explorer views (Section 7) introduce potentially large lists that need virtualization.

**Backend/generation pipeline.** This is where the real scalability ceiling lives today. Every
generation call races multiple full model candidates in parallel per request — a deliberate
reliability trade-off, but one that means system load scales faster than request volume (each user
request can trigger 2–3 simultaneous model calls). There is no caching of any kind (identical
requests are never short-circuited), no queuing (a burst of concurrent users all compete for the
same limited candidate pool with no fairness mechanism), and no backpressure/rate-limiting on
either the client-facing endpoints or the outbound calls to the model cluster.

**Recommendations:**
- **Scaling:** introduce a request queue with fair scheduling once concurrent usage grows beyond a
  handful of simultaneous users, rather than relying purely on "race every online candidate" per
  request.
- **Caching:** even a simple cache keyed on (product details + full profile configuration) would
  eliminate redundant model calls for identical repeated requests (common during iterative manual
  testing/demoing).
- **Observability:** today's only visibility is unstructured console log lines tagged by category
  (`[calypso]`, `[llm]`, `[oauth]`, `[proxy]`). A mature system needs structured, queryable logs at
  minimum, and ideally distributed tracing across the gap-analysis → generate → regenerate chain.
- **Monitoring/metrics:** per-candidate success rate, latency percentiles, and fallback-trigger
  rate are currently invisible — these should become first-class metrics, not something inferred
  from grepping logs after the fact.
- **Rate limiting:** no protection exists today against a single user (or a runaway client bug)
  issuing a flood of generation requests — this becomes a real cost and reliability risk the moment
  more than one person uses the system concurrently.

**Architecture-level recommendation:** the biggest single scalability unlock is decoupling
generation from the request/response cycle entirely — moving to an async job model (submit a
generation request, poll or receive a notification when it's ready) rather than holding an HTTP
connection open for the full duration of a potentially 60–120 second model call. This also
naturally enables queuing, retries, and fair scheduling that the current synchronous model makes
awkward.

---

## Section 12: Quality Assurance Strategy

**Current test coverage.** Genuinely strong for a single-developer-scale codebase: comprehensive
unit/component coverage of the deterministic generators, section-skeleton/dedup logic, session-
memory read/write/consolidation, client-side validation, and server-side prompt-assembly
correctness, plus acceptance-level end-to-end scenarios. This is a real strength worth explicitly
preserving as the codebase grows, not something to deprioritize in favor of new features.

**The gap:** every existing test validates *deterministic* logic (does the prompt string contain
the right guidance block; does the section list dedupe correctly) — none of them validate that a
*real model response* actually reflects that guidance. The only evidence that, say, reference-
document content genuinely influences generated output comes from manual, one-off live testing
against the real cluster, not from anything in the automated suite.

**Recommendations, in order of maturity:**
- **Integration tests** that exercise the full client → server → (mocked) Calypso round-trip,
  catching wiring bugs that unit tests of isolated functions can't (e.g. a field silently dropped
  between the client request and the server's prompt assembly).
- **E2E tests** against a real or realistically-mocked model, covering the full user journey
  (input → profile → generate → edit → regenerate → export) as a single flow, not just isolated
  component tests.
- **LLM evaluation tests** — the highest-value, currently-entirely-missing category: a fixed set
  of representative inputs run through real generation, scored against an explicit rubric (does
  the output actually follow the chosen format's structure; are there vague, hedge-word "requirement
  smells" the prompts explicitly warn against but never verify were avoided).
- **Prompt regression tests** — snapshot or rubric-based tests that fail loudly when a prompt-
  guidance change unexpectedly alters output for the fixed evaluation set, giving prompt authors
  the same regression safety net code changes already have.
- **Performance tests** — basic latency/success-rate benchmarks against the real Calypso cluster,
  run periodically (not on every commit, given cost/latency) to catch silent degradation in model
  candidate reliability over time.
- **Security tests** — currently no explicit security test coverage exists; once any
  authentication/multi-user capability is added (Section 9), this becomes mandatory (authorization
  boundary tests, input-sanitization tests for uploaded content, etc.).

**How quality should be maintained as the project grows:** treat the LLM evaluation/prompt
regression layer with the same seriousness as the existing unit-test discipline — every new
guidance block or profile setting should ship with both a deterministic unit test (already the
norm) *and* an entry in the evaluation set (not yet the norm), so prompt quality has the same
regression protection code quality already enjoys.

---

## Section 13: Known Technical Debt

**Server/dev-mode logic duplication** (`app/server.mjs` and `app/vite.config.ts`). The single
largest structural debt item: every prompt-guidance table, JSON schema, and the entire Calypso
HTTP client are hand-duplicated between these two files, by necessity of the production Docker
build copying only `server.mjs` into the runtime image. Every future change to generation logic
must be manually mirrored in both places or dev/prod behavior will silently diverge — this is a
compounding cost, not a one-time inconvenience, and gets more expensive with every feature added on
top of it. Recommended fix direction: change the Docker build to copy a small shared directory
instead of a single file, removing the constraint that created this duplication in the first
place.

**Naive positional heuristics.** `app/src/generation/sectionSchema.ts`'s Output Structure dedup
check and `app/src/App.tsx`'s `countEditedSections` both compare content by array position rather
than by any structural identity — both are explicitly documented in-code as an accepted "cosmetic
count only" trade-off. This is fine today, but a pure section *reorder* with no actual content
change would currently be miscounted as N differing sections rather than zero — worth revisiting
once templates with frequently-reordered sections become common.

**Fragile/unstructured content parsing.** `app/src/features/output/OutputView.tsx`'s
`parseSectionNames` (a plain regex over `## ` lines) is the entire mechanism behind the per-section
keep/rewrite feedback UI — it has no awareness of nested headings, code blocks containing `## `-
like text, or any other Markdown edge case. Low risk today given the model's consistent output
shape, but a real structural document model (rather than regex-over-Markdown) would be a more
robust foundation for the richer traceability/requirement-explorer features proposed elsewhere in
this document.

**Temporary/placeholder implementations.** The "Include web search results" checkbox is a
permanently-disabled visual placeholder with no backing implementation at all — appropriate as an
intentional "coming later" signal, but worth tracking explicitly so it isn't mistaken for a bug by
a future maintainer unfamiliar with its history.

**State-management ceiling.** All application state lives in local component `useState` inside
`app/src/App.tsx`, with no centralized store. This is entirely appropriate for today's single-user,
single-session scope, but will need to be revisited the moment any of Section 9's multi-user/
collaboration features are pursued — passing an ever-growing prop chain through a deepening
component tree does not scale past a certain point.

**Coupling concern: session-memory "most recent record" targeting.** `app/src/generation/
sessionMemory.ts`'s live-update functions (`setLastSessionEditedSectionCount`,
`incrementLastSessionThumbsDown`) always target the single most-recently-appended session record
with no correlation to which generation is actually being edited — a latent correctness gap in the
uncommon (but real) scenario of generating twice in a row without touching the first output first.

**Dead code.** `app/src/App-nex.tsx`, `app/src/routes/ApiExample.tsx`, `app/src/routes/Home.tsx`,
and the unused example endpoints in `app/src/api/client.ts` are scaffold leftovers with zero
imports anywhere in the codebase — low-risk, low-priority cleanup, but worth doing before a new
contributor spends time trying to understand code that isn't actually part of the running
application.

---

## Section 14: Differentiator Features

Ranked by how directly each one plays to SpecPilot's existing, genuine strengths (Section 2) vs.
how much net-new capability each would require — prioritize the top of this list first.

1. **Human edit learning** (highest priority). The system already captures the raw signal (what
   gets edited, what gets marked for rewrite) — it just doesn't analyze it yet. Turning this into
   genuine learning (Section 5's "learning from edits") is the single highest-leverage
   differentiator available, because the foundation already exists; it needs analysis, not new
   data collection.
2. **Standards-aware generation.** The 9-named-format system with real, distinct section
   skeletons and prompt guidance is already a genuine differentiator against generic "write me a
   PRD" tools — investing further here (more formats, a Template Marketplace, a Company Standards
   Library) compounds an existing strength rather than starting from zero.
3. **Session intelligence.** The existing recency-weighted preference system is a real, working
   foundation; extending it toward preference summarization and a visible Session Learning
   Dashboard (Section 7) turns an invisible background feature into a visible, explainable one —
   a meaningful trust and stickiness driver.
4. **Traceability automation.** Currently the *furthest* from real (entirely free-text today,
   Section 8), but also one of the clearest, most defensible enterprise differentiators once built
   — regulated-industry customers specifically evaluate tools on exactly this capability.
5. **Requirement quality scoring.** A natural extension of the evaluation framework proposed in
   Section 5/12 — surfacing an actual quality signal to the *user*, not just to internal testing,
   would be a distinctive feature few comparable tools offer today.
6. **Enterprise memory** (Company Standards Library + Shared Team Profiles, Section 7). Requires
   the Section 9 backend/multi-user prerequisite first, so it's appropriately sequenced later, but
   is a strong differentiator once that foundation exists.
7. **Customer-specific generation packs** (industry-specific bundles of templates + compliance
   framing + guidance, e.g. an "Automotive Safety" pack combining C4 Model + ISO 26262 + Compliance
   Grade depth as a one-click starting point) — the most speculative item on this list, best
   pursued only after the Company Standards Library infrastructure exists to support it.

**Recommended prioritization:** pursue items 1–3 in parallel during Phases 1–2 of the roadmap
(Section 4), since they build directly on existing strengths and require no new backend
infrastructure. Treat items 4–6 as the primary payoff of the Phase 3 backend investment. Reserve
item 7 until there's a concrete customer/vertical need to build it against.

---

## Section 15: Ideal Future Vision (24-Month Horizon)

In two years, executed by a strong, sustained engineering investment, SpecPilot should look like
this:

**User experience.** A guided, progressively-disclosed workflow where a first-time user sees only
the essential controls, while an expert user can drill into every lever this document describes —
with visible AI reasoning ("this section drew from your uploaded reference document"; "this
assumption was invented because Assumption Strategy is Exploratory"), a genuine diff view on every
regeneration, and a Session Learning Dashboard that makes the system's adaptation to a user's
preferences visible and correctable rather than invisible.

**AI capabilities.** A generation pipeline backed by a real evaluation framework — every prompt
change is tested against a fixed rubric before it ships, feedback mined from real user edits
continuously informs prompt refinement, and reference-document context is retrieved and ranked by
relevance rather than flatly concatenated. Quality scoring is visible to the user, not just to
internal testing, turning "trust the AI" into "verify the AI showed its work."

**Requirements engineering.** Requirement IDs are persistent and stable across the full life of a
document, backed by a real relationship graph — a Traceability Explorer lets a user visually
navigate CRS→TRS→verification chains, a Requirement Coverage Analysis automatically flags gaps
between PRD and TRS, and change-impact analysis tells a user exactly what else might need review
when a single requirement changes.

**Enterprise adoption.** A real backend with authenticated users, a Company Standards Library that
lets an organization set defaults once, and an approval/versioning workflow that makes SpecPilot a
credible tool for regulated-industry documentation rather than a personal drafting aid.

**Collaboration.** Shared Team Profiles, shared reference-document libraries, and a document
review/comment workflow that lets a team iterate on a generated document together, rather than
every user working in an isolated browser session.

**Quality assurance and testing.** Prompt changes are gated by the same rigor code changes already
enjoy today — LLM evaluation tests, prompt regression tests, and real performance benchmarks
against the model cluster, all running continuously rather than validated by manual, one-off
testing.

**Governance.** A full audit trail of what was generated, by whom, under what configuration, with
an approval workflow before anything is considered final — turning today's "generate and export"
model into a defensible, reviewable record suitable for a regulated environment.

**The through-line:** none of this requires abandoning what exists today — every item in this
vision is a direct extension of a genuine strength already present in the current system (Section
2). The core insight for whoever inherits this project is that SpecPilot's foundation — a
disciplined, per-DocType-aware generation pipeline with a working human-feedback loop — is sound
and worth building on. The work ahead is primarily about making the invisible measurable (AI
quality, traceability, usage patterns) and making the single-user experience multi-user and
governed, not about re-architecting what already works.
