# SpecPilot — User Manual

*A practical guide to generating high-quality PRDs, TRSs, and UX Specifications.*

---

## 1. Introduction

### What the application does

SpecPilot turns a short description of a product idea into professional, well-structured
documentation — automatically. In one session you can generate any combination of:

- **PRD** — a Product Requirements Document (business-facing: problem, solution, requirements)
- **TRS** — a Technical Requirements Specification (engineering-facing: architecture, NFRs, data,
  integrations)
- **UX Specification** — user journeys and text-based UI mockups

SpecPilot uses an AI writing assistant to draft these documents in seconds to a couple of minutes,
following recognized industry documentation styles (e.g. Volere, IEEE-style SRS, C4 architecture
model, Jobs-to-Be-Done, and more). If the AI service is temporarily unavailable, SpecPilot will
still produce a basic, ready-to-edit draft using a built-in fallback writer, so you're never left
with nothing.

### Who should use it

- **Product Managers** drafting a first-pass PRD before a kickoff meeting.
- **Systems/Requirements Engineers** who need a formally structured TRS to hand to a development
  team.
- **Business Analysts** capturing requirements from stakeholders into a standard format.
- **UX Designers** who want a quick first draft of user journeys and screen structure before
  moving into a design tool.

### When to use it

- At the **start** of a new initiative, to get a solid first draft instead of a blank page.
- When you need documentation in a **specific standard format** (e.g. your team requires Volere,
  IEEE SRS, or C4-style architecture sections) and don't want to hand-build the structure.
- When you already have a rough idea and want to **iterate quickly** — generate, edit, give
  feedback, regenerate — rather than write everything from scratch.

SpecPilot is a **drafting accelerator**, not a replacement for review. Always read, verify, and
edit the output before treating it as final — see §9 and §13 for how to get the best results and
avoid common mistakes.

---

## 2. Understanding the Workflow

```
Create Project → Configure Generation Profile → Upload Supporting Documents (optional)
   → Answer Clarifications (if asked) → Generate Documents → Review Results
   → Provide Feedback → Regenerate (optional, repeat as needed) → Export Final Artifacts
```

1. **Create Project** — enter your product's title and description, and choose which document
   type(s) you want (§3).
2. **Configure Generation Profile** — for each document type you chose, pick a format/template,
   tone, depth, and other settings; optionally upload supporting documents (§5, §6).
3. **Answer Clarifications** — the AI may ask a handful of quick follow-up questions if something
   important is missing (§7). You can also skip this step entirely.
4. **Generate Documents** — SpecPilot writes the full document(s) for you.
5. **Review Results** — read through each generated document in its own tab (§8).
6. **Provide Feedback / Regenerate** — edit content directly, add comments, mark sections to keep
   or rewrite, and ask SpecPilot to regenerate with your feedback incorporated (§10).
7. **Export Final Artifacts** — download your finished document as a Word file, a PDF, or (for UX)
   an HTML mockup file.

Your generation history and learned preferences are automatically kept track of in the background
throughout this process — see §11.

---

## 3. Starting a New Project

### Product Title

**What it is:** A short name for your product or initiative. It appears as the heading of every
document you generate and in the exported file names.

**Best practices:** Keep it specific and recognizable — the name you'd actually call this project
in a meeting.

**Good examples:** "Acme Task Tracker", "Vehicle Battery Health Monitor", "Regional Sales Portal
Redesign".

**Bad examples:** "New Project", "Test", "Untitled", "asdf" — a vague or placeholder title doesn't
itself break generation, but it's a missed opportunity: the AI does use the title as a small piece
of context, and a real name simply reads better throughout the document.

### Product Details

**What information should be included:** This is the single most important field you fill in — it
is the main source of truth the AI uses to write everything else. Aim to cover:
- What the product **is** and what problem it solves.
- **Who** it's for (even a one-line description of the target user/customer).
- The **core capabilities** it needs to have.
- Any **known constraints** (budget, timeline, must-integrate-with systems, regulatory
  considerations).

**How much detail is recommended:** A solid paragraph (roughly 3–6 sentences) is usually enough
to get a strong first draft. More detail generally produces more specific, less generic output —
see §9 for exactly how detail level affects quality.

**Good example:**
> "A lightweight web app for small teams (3–15 people) to track tasks, deadlines, and ownership
> across multiple projects. Must work offline and sync automatically. Competitors charge
> per-seat, which is a pain point for our target customers — we want flat, per-project pricing.
> Needs CSV export and Slack notifications at launch. No native mobile app planned for v1."

**Bad example:**
> "A task app." — technically valid (it will still generate something), but the result will be
> generic and will lean heavily on assumptions rather than your actual product.

### Document Types

Check any combination of the three. Each one you check gets its own full document and its own
settings panel on the next screen.

- **PRD** — check this when you need to communicate *what* to build and *why*, to stakeholders,
  leadership, or a product team. Use it to align on scope before engineering work starts.
- **TRS** — check this when engineering needs a formal technical specification: architecture,
  non-functional requirements, data, integrations, and test/validation approach.
- **UX** — check this when you need a first-pass user journey and a rough sketch of the screens/
  flows involved, before a designer builds real mockups.

You can select one, two, or all three at once — they're generated from the same product
description, so they stay consistent with each other.

---

## 4. Guided Questions

After you check a Document Type, a small set of **optional** extra questions appears — only the
ones relevant to the type(s) you picked. None are required, but each one measurably improves the
matching section of your generated document.

### PRD questions

**"Who are the primary target users of this product?"**
- *Why it matters:* directly shapes the Persona/Journey section instead of a generic "a user."
- *Example answer:* "Small business owners managing a team of 3–10 people."

**"Any known constraints or explicit non-goals?"**
- *Why it matters:* feeds the Exclusions section with real, specific scope boundaries instead of a
  vague disclaimer.
- *Example answer:* "No native mobile app in v1. Budget capped at $50k for the first release."

**"How will you know this product succeeded?"**
- *Why it matters:* gives the Success Criteria section a measurable target instead of a generic
  aspiration.
- *Example answer:* "80% of surveyed users report saving at least 2 hours/week within 90 days."

### TRS questions

**"Any known systems/integrations this must work with?"**
- *Why it matters:* directly informs the Integration Requirements section.
- *Example answer:* "Must integrate with Slack and our existing SSO provider (Okta)."

**"Does this handle sensitive or regulated data?"**
- *Why it matters:* shapes the security/data-handling parts of the Non-Functional Requirements
  section.
- *Example answer:* "Yes — stores employee names and emails; must comply with GDPR."

**"Where will this be deployed/run (cloud, on-prem, mobile, etc.)?"**
- *Why it matters:* informs the Deployments section with a real target instead of a generic
  assumption.
- *Example answer:* "AWS-hosted, single region, containerized."

### UX questions

**"What is the primary user journey or entry point?"**
- *Why it matters:* anchors the main journey described instead of an assumed one.
- *Example answer:* "User receives an email invite, clicks a link, and completes onboarding."

**"What platform(s) - web, mobile, desktop?"**
- *Why it matters:* shapes what the mockups assume about screen size/interaction model.
- *Example answer:* "Responsive web only, no native app."

**Bottom line:** answer whichever of these you have a real answer for; leave the rest blank and
move on. There's no penalty for skipping any of them.

---

## 5. Generation Profile

After clicking **Continue**, you'll see a settings panel for **each** document type you selected,
plus a few settings shared across all of them. Nothing here is required — every setting has a
sensible default that matches a standard, professional-quality document — but tuning them lets you
get a document that's a much closer match to what you actually need.

### Template

This is the single biggest lever you have — it changes both the **structure** (which sections
exist) and the **writing style** of the document.

- **PRD:** Standard, **Volere** (adds measurable "Fit Criteria" to every requirement, plus a
  more formal stakeholder/constraints structure), **PR/FAQ** (Amazon-style "Working Backwards"
  press release + FAQ, written for a customer audience), **Shape Up** (a short, fixed-time-box
  pitch format — great for a scoping conversation, not a full spec).
- **TRS:** Standard, **EARS** (keeps the same sections as Standard, but phrases every requirement
  in one of six precise, testable sentence patterns — good when your engineering team wants
  unambiguous, review-ready requirement wording), **Formal SRS** (IEEE-style formal outline, good
  when a customer or regulator expects a recognized standard), **C4 Model** (replaces the
  architecture section with four distinct zoom levels — system context, containers, components,
  and how they interact — good for a more technical, architecture-focused audience).
- **UX:** Standard, **Service Blueprint** (splits actions into what the customer sees vs. what
  happens behind the scenes — good for service-design-minded teams), **Jobs-to-Be-Done** (frames
  the product around the underlying motivation driving a user to "hire" it — good for early,
  more strategic UX thinking), **Atomic Design** (breaks the UI down from small reusable elements
  up to full populated pages — good when your design team already thinks in a component library).
- **Upload your own template (Custom):** see §6.

**Tip:** hover your mouse (or, using a keyboard, tab to focus) over any of these options to see a
short live preview of what that format's structure and writing style actually look like, using a
worked example. Use this to decide which one fits before committing — you don't have to guess.

### Generation Mode

A "lens" that adjusts tone/emphasis without changing the section structure.

- **PRD:** Customer Value, **Product Management** (default — balanced business + planning tone),
  Engineering Handoff (more precise about boundaries, for a team about to scope work), Executive
  Summary (leads with business impact for a time-constrained leadership audience).
- **TRS:** **Strict TRS** (default — standard technical spec tone), Functional Decomposition
  (emphasizes breaking the system into building blocks), Implementation-Oriented (leans toward
  concrete technical detail where your input supports it), Verification-Oriented (states how each
  requirement would be tested, alongside the requirement itself).
- **UX:** **User Journey** (default), Wireframe Generation (emphasizes detailed screen
  descriptions over journey narrative), Interaction Design (emphasizes what happens on click/
  hover/error/success), Accessibility Focus (calls out accessibility considerations throughout),
  Research & Discovery (emphasizes open questions/assumptions to validate over a finished design).

**When to use each:** pick the mode that matches who will actually read the document day-to-day.

### Requirement Depth

Controls how much supporting detail accompanies each requirement.
- **High Level** — brief, capability-focused, no extra rationale.
- **Standard Engineering** (default) — today's normal level of detail.
- **Detailed Engineering** — adds brief rationale and likely edge cases per requirement.
- **Compliance Grade** — adds rationale, edge-case handling, and a verification/traceability note
  per requirement — use this when the document may face a formal compliance or safety review.

### Requirement Decomposition

Controls the *granularity* at which requirements are written.
- **Feature** — whole user-facing capabilities.
- **Functional Requirement** (default) — today's normal granularity.
- **Sub-System** — grouped by named sub-system.
- **Component** — broken down to individual components.
- **Signal/Interface** — broken down to individual signal/interface level.

Use finer granularity (Component/Signal-Interface) mainly for TRS when your engineering team needs
requirements broken down to implementation-ready detail.

### Target Audience

Adjusts vocabulary and depth for who's actually going to read it: **Engineering**, **Product**,
**Customer**, or **Management**. Defaults are chosen sensibly per document type (PRD/UX default to
Product, TRS defaults to Engineering) — change it if your actual reader is different, e.g. set a
PRD to "Customer" if you're sharing it externally, or a TRS to "Management" if it's going to a
budget-approval meeting.

### Assumption Strategy

Controls how the AI handles gaps in what you've told it.
- **Strict** — never invents anything; missing information is explicitly listed as an Open Issue/
  Assumption instead.
- **Balanced** (default) — today's normal behavior.
- **Exploratory** — proactively proposes a plausible, clearly-labeled answer instead of flagging a
  gap — favors forward progress over asking more questions.

Use **Strict** when you plan to review every assumption carefully yourself (e.g. a regulated or
safety-relevant product); use **Exploratory** when you want a fuller first draft fast and don't
mind reviewing more invented content afterward.

### Innovation Assistance

Controls how creative/proactive the AI is, from **Disabled** (default — stick strictly to what's
stated or clearly implied) up through **Suggest Missing** (proposes requirements it thinks are
missing, clearly labeled as suggestions), **Challenge Assumptions** (questions things you stated
and proposes alternatives), **Explore Alternatives** (proposes at least one clearly-labeled
alternative approach), to **Maximum Ideation** (freely proposes novel ideas and alternative
designs, all clearly labeled as ideation, not confirmed requirements).

**Honest note:** any setting above Disabled also makes the AI's writing noticeably more
exploratory/creative in general, since it's more willing to take chances with wording throughout
the document, not just within the specifically-labeled suggestion sections. SpecPilot explicitly
instructs the AI to keep your core, directly-requested content grounded in what you actually told
it regardless of this setting, and to confine extra creativity to the clearly-labeled additions —
but this is guidance, not a hard guarantee. The higher you go, the more carefully you should review
the output before treating anything in it as a firm requirement — see §13.

### Compliance Framing

Two independent checkboxes: **ASPICE** and **ISO 26262**. Checking either asks the AI to frame
requirements using that standard's language and, for ISO 26262, to flag anything that looks
safety-relevant. **Honest note:** this makes the document read in a more compliance-aware way — it
does **not** turn the document into an officially certified ASPICE or ISO 26262 work product. Any
real compliance submission still needs expert review.

### Traceability Controls

Three checkboxes, in this order of dependency:
1. **Generate requirement IDs** — assigns a short ID (e.g. `CRS-001`, `TRS-014`) to each
   requirement so it can be referred to elsewhere.
2. **CRS → TRS mapping** — additionally states which PRD requirement each TRS requirement
   fulfills (e.g. "fulfills CRS-PRD-003").
3. **Verification references** — additionally cites requirement IDs inside the Test and
   Validation section.

**Important:** options 2 and 3 are grayed out until you check option 1 first — they have nothing
to reference without IDs existing. Check "Generate requirement IDs" first, and the other two
become available.

**Honest note:** SpecPilot now asks the AI to reuse the same ID for a requirement it recognizes
as unchanged when you regenerate with feedback (§10), which makes IDs noticeably more stable in
practice than before. That said, this is still the AI doing its best to recognize "the same"
requirement, not a guaranteed, verified system — for anything where you truly need IDs to never
change, don't rely on this alone; track them manually as a backstop. Traceability also has no
effect on a UX-only generation (there's nothing in a UX document for these IDs to attach to), so
this section won't even appear if UX is the only type you selected.

### Output Structure

Optional extra sections you can add on top of whatever the Template already includes: **User
Stories**, **Acceptance Criteria**, **Risks**, **Dependencies**, **Open Questions**, **Wireframe
Suggestions**, **Edge Cases**, **Validation Criteria**. Each only appears as an option for the
document types it's relevant to.

If the Template you picked already has an equivalent section (e.g. Standard PRD already has
"Risks and Dependencies"), the matching checkbox is automatically grayed out with a tooltip
explaining why — this prevents you from accidentally asking for the same content twice under two
different headings. Switching templates (or uploading a different custom template) re-checks this
automatically.

### Generate

Once you're happy with the settings for every selected document type, click **Generate**. This
kicks off the whole process — you'll either see a short round of clarifying questions (§7) or go
straight to your generated documents.

---

## 6. Uploading Supporting Documents

These live in the **Context Sources** area of the Generation Profile screen.

### Custom Templates

**What to upload:** a `.txt`, `.md`, or `.docx` file containing your own section headings (select
"Upload your own template" as that document type's Template first). This is per document type —
if you're generating both a PRD and a TRS, you can upload a completely different custom template
for each.

**What happens after upload:** SpecPilot reads your file and shows you the exact list of section
names it extracted, so you can confirm it understood your structure correctly.

**How it affects generation:** the generated document will use **exactly** those section
headings, in that order — nothing added, nothing renamed. Uploading a new file for the same
document type replaces the previous one.

### Reference Documents

**What to upload:** up to three background documents (`.txt`, `.md`, `.docx`, or `.pdf`) — e.g.
competitor research, an existing spec, customer feedback notes — anything that gives the AI extra
real-world facts to draw from.

**What happens after upload:** the file's text is extracted and added to a shared pool (most
recent 3), used identically across **every** document type you're generating in this session —
there's no way to point a reference document at only one document type. Once it's added, you'll
see a confirmation listing a short preview of each uploaded document's content, so you can confirm
SpecPilot actually read what you expected.

**Honest note:** if you're uploading a `.pdf` and the preview looks empty or oddly short, try
converting it to a plain text or Word file and re-uploading instead — PDF handling is newer and
less consistently reliable than the other file types.

**How it affects generation:** the AI is explicitly told to treat these as background context
only — useful for accuracy and terminology — not as more authoritative than what you typed in
Product Details. It won't copy them verbatim.

### Style Examples

**What to upload:** one previously generated document (any format) that has the tone/level of
detail you want to match.

**What happens after upload:** it's stored and used purely as a style reference.

**How it affects generation:** the AI is told to match its *tone and level of detail*, not to copy
its actual content. Use this when you've generated a document before that "read" the way you like,
and want future generations to feel consistent with it.

---

## 7. Clarification Questions

**Why they appear:** before writing your document(s), the AI reviews what you've told it and, if
something important seems missing or ambiguous, asks up to five short follow-up questions — e.g.
about your user personas, core workflows, or non-functional requirements.

**How answering them helps:** the more specific your answers, the more specific (and testable)
your generated requirements will be, instead of generic placeholders.

**When to skip:** if you don't have a confident answer, or you've already covered it in Product
Details, it's perfectly fine to leave a question blank or click **Skip** entirely — generation
proceeds either way. Skipping is not penalized; it simply means the AI will make a reasonable
assumption instead.

**Best practice:** answer whichever questions you can answer confidently in one or two sentences;
don't feel obligated to answer all of them.

**Note:** sometimes no questions appear at all — that means your Product Details were already
detailed enough that the AI didn't need to ask anything.

---

## 8. Understanding Generated Output

Each generated document appears in its own tab, with an **Edit** view (plain text you can modify)
and a **Preview** view (formatted, easier to read). The exact section list depends on the Template
you chose (§5) — what follows describes the **Standard** template for each document type.

### PRD (Standard)

1. **Problem Statement** — the real pain the product addresses.
2. **Business Case** — who benefits and how that benefit is measured.
3. **Proposed Solution** — the approach, at a level a non-technical stakeholder can follow.
4. **Functional Requirements** — what the product must do, phrased as testable "shall" statements.
5. **User Personas and their Journey** — who uses it and how they move through the product.
6. **Exclusions** — what's deliberately out of scope for this release.
7. **Success Criteria** — how you'll know it worked, ideally with a measurable number.
8. **Assumptions** — things expected to be true but not guaranteed.
9. **Risks and Dependencies** — what could go wrong, and what the product depends on.

**Usage:** share with stakeholders/leadership to align on scope before technical work begins.

### TRS (Standard)

1. **Summary** — a short technical abstract.
2. **Problem Statement and Proposed Solution** — the technical framing of the approach.
3. **High Level Architecture** — the actual components/layers and how they communicate.
4. **System Boundaries** — what's in scope vs. an external dependency.
5. **Non-Functional Requirements** — reliability, availability, security, maintainability,
   portability, performance.
6. **Data Requirements** — what data is created/read/stored, and how sensitive it is.
7. **Integration Requirements** — external systems/APIs involved.
8. **UI Requirements** — functional UI needs (views, roles, states) — not visual design.
9. **Test and Validation** — how the requirements above will be verified.
10. **Risks and Dependencies** — technical risks, distinct from business-level ones.
11. **Deployments** — where/how the system runs.
12. **AI Usage and Implications** — any AI/ML use in the product itself, and its implications (or
    a plain statement that none is used).

**Usage:** hand to an engineering team as the basis for technical scoping and implementation.

### UX Specification

1. **User Journeys for personas** — a step-by-step walk-through of a specific persona using the
   product.
2. **UI Design Mockups** — a simple, text-based sketch of the key screens/layout (not a graphical
   design — think of it as a rough wireframe in text form, meant to be a starting point for a
   real design tool, not a finished design).

**Usage:** a fast first pass to align on flow and structure before a designer builds real,
polished mockups.

---

## 9. Improving Results

**Write a better Product Details paragraph.** This has the single biggest impact on quality.
Compare:
- *Weak:* "An app for tracking tasks."
- *Strong:* "A web app for small teams (3–15 people) to track tasks and deadlines across
  projects, with offline support and Slack notifications, competing against per-seat tools by
  offering flat per-project pricing."

**Upload real supporting documents.** A genuine competitor analysis, an existing internal spec, or
real customer feedback (§6) grounds the output in facts instead of the AI's own guesses.

**Choose the Template that matches your actual audience/standard**, rather than leaving everything
on Standard by default — e.g. if your organization already uses IEEE-style specs, pick Formal SRS
so you don't have to manually restructure the output afterward.

**Match Requirement Depth/Decomposition to who will use the document.** A quick internal pitch
doesn't need Compliance Grade depth; a document headed for a formal review probably does.

**Answer the guided questions and clarifications you can answer confidently** (§4, §7) — even one
or two good answers meaningfully sharpens the relevant section.

---

## 10. Regeneration & Feedback

Once you have a generated document, you can refine it without starting over.

**Editing content:** click into the Edit pane for any tab and change the text directly, exactly
like editing a plain text document. Your edits show up live in the Preview pane next to it.

**Adding comments:** once you've made an edit, a **"Regenerate with my edits"** button appears.
Clicking it opens a free-text box: *"What would you like different? (optional)"* — use this to
describe, in plain language, what you want changed or expanded.

**Thumbs-up/down controls:** below the comment box, every section (based on its heading) gets a
👍 / 👎 pair.
- 👍 signals "keep this section largely as-is."
- 👎 signals "rewrite this section from scratch."
- Clicking an already-active choice again un-marks it (back to no preference).
- You don't have to mark every section — only mark the ones you have a strong opinion about.

**Regenerate with my edits:** clicking **Confirm regenerate** sends your edited text, your
comment, and your keep/rewrite marks back to the AI, with instructions to preserve the intent
behind your edits and to more heavily rewrite only the sections you marked 👎.

**Honest note:** if the AI service happens to be unavailable at the exact moment you regenerate, a
message will tell you it fell back to a basic rewrite — in that case, your edits/comment/marks
could **not** actually be incorporated that time. If you see that message, wait a moment and try
regenerating again.

### How to give good feedback

**Good feedback (specific, actionable):**
- Comment: *"Add a requirement about exporting data to CSV, and expand the security section to
  mention encryption at rest."*
- Marking only the "Non-Functional Requirements" section 👎 because it was too generic, while
  leaving everything else 👍.

**Poor feedback (vague, contradictory, or unusable):**
- Comment: *"Make it better."* — gives the AI nothing concrete to act on.
- Marking every single section 👎 with no comment — the AI has no signal for *what* was wrong with
  each one, so a full rewrite may not fix your actual concern.
- Directly editing a requirement to say one thing, then commenting something that contradicts it
  — be consistent between your direct edits and your comment.

---

## 11. Session History

Available from the **"Your generation history"** panel at the top of the app.

**What is stored:** for each past generation, the date/time, your product title, and — per
document type — which Template, Generation Mode, Requirement Depth, Requirement Decomposition,
Innovation Assistance, and Target Audience you used, plus a simple count of how many sections you
edited and how many you marked 👎 for that document.

**What is *not* stored:** the actual document content, your free-text comments, or your uploaded
reference/style documents.

**What preferences are remembered:** over time, your most commonly-chosen settings become the
pre-filled defaults the next time you open the Generation Profile screen for a new project — so
the tool gradually adapts to how you tend to work. This is entirely local to the browser/device
you're using — it isn't shared with colleagues or across different computers.

**Opting a generation out:** the **"Use my prior preferences"** checkbox (checked by default) —
if you uncheck it before generating, that particular generation won't be added to what future
sessions learn from. Useful for a one-off, unusual project that shouldn't skew your normal
defaults going forward.

**How to use previous history:** expand any row to see the full detail of what settings were used
for that generation — handy for remembering "what did I pick last time I made something like
this?"

**How to clear learned preferences:** click **"Clear my learned preferences"** at the bottom of
the history panel. This permanently erases your entire history and resets every setting back to
its original default — this cannot be undone.

---

## 12. Best Practices

### For Product Managers
- Lead with the business problem and success metric in Product Details — the AI leans on this
  heavily for the Business Case and Success Criteria sections.
- Try **PR/FAQ** format when you want to pressure-test whether the idea is truly customer-centric
  before writing a traditional PRD.
- Use **Exploratory** Assumption Strategy for early-stage brainstorming; switch to **Strict**
  once you're finalizing scope, so nothing gets silently assumed.

### For Systems Engineers
- Prefer **EARS** or **Formal SRS** templates when your requirements need to survive a formal
  technical review.
- Turn on **Detailed Engineering** or **Compliance Grade** Requirement Depth for anything destined
  for a safety or compliance review, and pair it with the **ISO 26262**/**ASPICE** Compliance
  Framing checkboxes where relevant.
- Use **Traceability Controls** (Generate requirement IDs, then optionally CRS → TRS mapping and
  Verification references) when you need PRD-to-TRS-to-test traceability in the document itself —
  just remember IDs aren't guaranteed to stay identical across separate regenerations.

### For Business Analysts
- Answer as many guided questions as you can — they map almost directly onto the sections
  stakeholders will scrutinize (personas, constraints, success criteria).
- Upload real reference documents (existing specs, prior research) rather than relying on the AI
  to infer everything from a short description.

### For UX Designers
- Try **Jobs-to-Be-Done** when you want to validate the underlying motivation before designing
  screens; try **Atomic Design** once you're ready to think in reusable components.
- Remember the UI Design Mockups section is a **text-based sketch**, not a real design — use it as
  a fast starting conversation, then move into your actual design tool.

---

## 13. Common Mistakes

- **Too little input detail.** A one-sentence Product Details paragraph produces a generic,
  assumption-heavy document. Invest a few minutes writing a real paragraph (§9).
- **Uploading a poorly-structured custom template.** If your uploaded template's headings are
  vague or inconsistent, the generated content under each heading will be too — the AI can only
  infer style from the section names themselves when using a custom template.
- **Overusing Innovation Assistance.** Setting it to **Maximum Ideation** for a document that
  needs to be taken literally (e.g. a formal spec heading into review) will fill it with
  speculative, clearly-labeled ideation that still needs to be manually filtered out — reserve
  higher settings for early brainstorming.
- **Contradictory instructions.** Don't answer a guided question one way and then write something
  contradictory in Product Details (or in a regenerate comment) — be consistent, since the AI will
  try to honor everything you've told it.
- **Checking a Traceability sub-option without the main one.** "CRS → TRS mapping" and
  "Verification references" only do anything once "Generate requirement IDs" is also checked —
  they're grayed out otherwise as a reminder.
- **Expecting the UX output to be a real, graphical mockup.** It's a text-based sketch meant to
  jump-start a real design tool, not a finished design deliverable.
- **Not checking the upload confirmation preview.** Reference document and style example uploads
  now show a short preview of what was extracted (§6) — glance at it to catch a failed or
  unexpectedly empty extraction (common with problematic PDFs) before you generate.

---

## 14. Example End-to-End Scenarios

### Example 1: Meeting Summarizer

- **Product Title:** "MeetingBrief"
- **Product Details:** "A tool that ingests a meeting transcript and produces a concise summary,
  action items with owners, and key decisions. Used by internal teams after video calls. Must
  integrate with our existing calendar tool to auto-detect meeting end times."
- **Document Types:** PRD, TRS
- **Guided Questions answered:** target users = "Team leads and project managers who attend 5+
  meetings a week"; success metric = "Users report saving 10+ minutes per meeting on note-taking."
- **Profile selections:** PRD → Template: Standard, Generation Mode: Product Management. TRS →
  Template: Standard, Target Audience: Engineering.
- **Uploaded documents:** none.
- **Expected output:** a PRD focused on the summarization/action-item workflow and adoption
  metrics; a TRS covering transcript ingestion, an NLP/summarization component, and calendar
  integration requirements.

### Example 2: Vehicle Health Monitoring System

- **Product Title:** "Vehicle Battery Health Monitor"
- **Product Details:** "An in-vehicle system that continuously monitors battery state of charge,
  temperature, and degradation, alerting the driver and logging data for maintenance. Safety-
  relevant: must not distract the driver or cause false alarms."
- **Document Types:** PRD, TRS
- **Guided Questions answered:** data sensitivity = "Yes — vehicle telemetry data, must be
  tamper-evident"; deployment = "Embedded automotive ECU, real-time constraints."
- **Profile selections:** PRD → Template: Volere (for its Fit Criteria and formal constraints
  structure). TRS → Template: C4 Model, Requirement Depth: Compliance Grade, Compliance Framing:
  ISO 26262 checked, Traceability: Generate requirement IDs checked.
- **Uploaded documents:** a reference document with existing sensor specifications.
- **Expected output:** a Volere-structured PRD with explicit Fit Criteria per requirement and
  separate Risk/Open-Issue lists; a C4-Model TRS with distinct System Context/Containers/
  Components/Dynamic Scenarios sections, ISO-26262-aware safety flagging, and requirement IDs
  throughout.

### Example 3: AI Requirements Assistant

- **Product Title:** "SpecPilot" *(yes — describing a tool like this one is a valid use case)*
- **Product Details:** "A web application that generates PRD/TRS/UX documentation from a short
  product description using an AI assistant, with configurable document formats and a human
  feedback loop for regeneration."
- **Document Types:** PRD, TRS, UX
- **Guided Questions answered:** target users = "Product managers, requirements engineers, and UX
  designers drafting early-stage documentation"; platform = "Responsive web app."
- **Profile selections:** PRD → Template: PR/FAQ (to pressure-test the customer story).
  TRS → Template: Formal SRS. UX → Template: Jobs-to-Be-Done.
- **Uploaded documents:** a style example from a previously generated, well-liked PRD.
- **Expected output:** a customer-voiced PR/FAQ PRD; a formally-structured SRS-style TRS; and a UX
  document framed around the underlying jobs the tool helps users accomplish, all matching the
  tone of the uploaded style example.

---

## 15. FAQ

**Does this always use AI, or can I trust it works without an internet/AI connection?**
SpecPilot always tries the AI service first. If it's temporarily unavailable, you'll still get a
basic, ready-to-edit document from a built-in fallback writer — you'll see a banner explaining
that's what happened. The fallback doesn't use your Generation Profile settings, only your basic
title/details/document types.

**Why do I sometimes see clarifying questions, and sometimes not?**
The AI only asks if it judges something important is missing. Detailed Product Details plus
guided-question answers often means there's nothing left to ask.

**Why are some Traceability checkboxes grayed out?**
"CRS → TRS mapping" and "Verification references" require "Generate requirement IDs" to be checked
first — see §5.

**Can I preview a format before choosing it?**
Yes — hover or keyboard-focus any named Template option (not Standard or Custom) to see a short
worked example of its structure and style.

**What confirmation do I get after uploading a reference document or style example?**
A short preview of the extracted text appears right below the upload control (see §6). If it
looks empty or unexpectedly short, the file likely didn't extract cleanly — try a different file
format.

**Can I generate more than one document type at once, and will they be consistent with each
other?**
Yes — check multiple Document Types and each gets generated from the same Product Title/Details,
so they stay aligned, even though each has its own independent settings.

**Will my uploaded reference documents apply to only one document type (e.g. just the TRS)?**
No — reference documents and the style example are shared across every document type you generate
in that session; there's currently no way to scope one to a single document type.

**Is my data saved permanently anywhere, or shared with anyone else?**
Your generation history and learned preferences are kept only in your own browser on your own
device — they aren't sent anywhere else or shared with other users. Clearing your browser data, or
using "Clear my learned preferences," removes them completely.

**Can requirement IDs be trusted to stay the same if I regenerate a document later?**
No — treat them as freshly assigned each time you generate. If you need IDs to stay perfectly
stable across edits, don't rely on this feature alone; track them manually going forward.

**What should I do if a generated section still doesn't sound right after regenerating once?**
Try being more specific in your comment and marking exactly the section(s) that are wrong 👎 while
leaving the rest 👍 — vague or blanket feedback tends to produce another generic rewrite (§10,
§13).
