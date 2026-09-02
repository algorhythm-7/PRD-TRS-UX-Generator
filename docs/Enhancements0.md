# Enhancements 0 - Adding LLM-Assisted Generation to SpecPilot

## Status

This is a **planning document only** - no code has been changed to produce it. It answers the
question raised in the pasted conversation ("can we use OpenRouter, which models, can it be
local") against the *actual current architecture* documented in `docs/ArchitectureUpdated.md`
and `docs/FlowUpdated.md`, plus fresh research on OpenRouter and Ollama done for this document.
Nothing here should be implemented until you have reviewed and picked a direction from section 9.

**Basis:** `docs/ArchitectureUpdated.md`, `docs/FlowUpdated.md`, `docs/Spec.md`,
`docs/MigrationDecision1.md`, `AGENTS.md`, and live web research (OpenRouter docs/models pages,
Ollama OpenAI-compatibility and structured-outputs blog posts), all accessed while writing this
document.

---

## 1. The one decision that matters most, stated up front

**Adding an LLM is a reversal of an explicit, documented product decision, not just a technical
add-on.** `docs/Spec.md`'s Non-Goals state: *"Integration with an external large-language-model
provider is out of scope; generation is deterministic."* The old repository even had a dedicated
`adr/ADR-DETERMINISTIC.md` recording this (it was not carried into this repository during the
XYZ migration, but the decision it recorded is still reflected in `docs/Spec.md` and in every
generator's zero-dependency, zero-randomness implementation today).

This isn't a reason not to do it - the pasted conversation makes a good case that the current
output ("filling a form and pasting the same content in a formatted way") is not good enough, and
an LLM is the correct way to fix that. But it **is** a reason to treat this as a conscious,
recorded product decision - update or replace the determinism non-goal explicitly - rather than a
silent architecture drift. Section 9 lists this as decision #1 you need to sign off on.

## 2. What "OpenRouter" and "Ollama" actually are (research findings)

These two names are not two flavors of the same thing. They solve different problems, and the
pasted conversation's "local/open-source" framing conflates two independent axes:

|  | **What model runs** | **Where it runs** | **Who sees your prompt data** |
| --- | --- | --- | --- |
| **OpenRouter** | You choose from ~400+ models: open-weight ones (Qwen, Llama/Meta, DeepSeek, Mistral, GLM, etc.) *and* closed ones (GPT, Gemini, Claude) | OpenRouter's cloud infrastructure, which itself forwards the request to one of several underlying hosting providers (e.g. Fireworks, DeepInfra, Together, Groq, or the model owner's own API) | OpenRouter, plus whichever underlying provider served that specific request. Per-provider data retention/training policy varies and is published; you can filter requests to only use providers with a "does not train" / "zero retention" policy, and Enterprise plans support EU/US in-region routing - but data still leaves your company network |
| **Ollama** | Any open-weight model you pull (Qwen, Llama, Mistral, DeepSeek, etc. - the *same* model families OpenRouter offers) | A server **you** run - your own GPU box, on-prem or in your own cloud account | Nobody outside your own infrastructure |

**Key correction to the premise in the pasted conversation:** "Ollama hosted on GPU" (self-hosted,
true zero-egress) and "OpenRouter" (managed API aggregator, data leaves the network) are
**alternatives to each other**, not the same category of thing. You can run the *exact same*
Qwen3 32B or Llama 3.3 70B model either way - the question is only whether it runs on your own
GPU (Ollama) or on OpenRouter's/a partner's cloud GPUs (OpenRouter). Both expose an
**OpenAI-compatible `/v1/chat/completions` API** (confirmed for both, live docs checked for this
document), which is the single most useful fact for architecture purposes: **the exact same
client code can talk to either one**, differing only in `baseURL` and API key. This means the
"which provider" decision does not need to be locked in before building the feature - it can be
a deployment-time configuration choice (see section 5).

Both also support **structured/schema-constrained JSON output** (OpenRouter's `response_format:
{type:"json_schema"}`, Ollama's `format: <json-schema>`), which is the mechanism this plan relies
on to keep LLM output compatible with `docs/Spec.md`'s exact-section-order requirements (see
section 6).

### Models mentioned in the pasted conversation, and where they fit

| Model | Open-weight? | Available on OpenRouter? | Available via Ollama (local)? | Fit for this use case |
| --- | --- | --- | --- | --- |
| Qwen3 (32B and other sizes) | Yes | Yes | Yes | Strong at structured document/technical writing; good default choice per the conversation |
| Llama 3.3 70B | Yes | Yes | Yes (needs a serious GPU) | Strong reasoning/gap-detection; heavier to self-host |
| Mistral Large / Mixtral | Yes (Mixtral); Mistral Large has mixed licensing | Yes | Yes (Mixtral; Mistral Large has restrictions) | Good speed/quality balance |
| DeepSeek (V3/V4 family) | Yes | Yes | Yes | Competitive quality, often cheaper on OpenRouter |

None of this changes the recommendation below - it's included so the model choice and the
hosting-location choice can be made independently and explicitly, instead of accidentally coupled.

## 3. Why this cannot be "just call the LLM from the browser"

The current app (per `docs/ArchitectureUpdated.md`) is a **pure client-side application with zero
backend calls** - this was the correct decision for deterministic, side-effect-free generation
(Architecture B in `docs/MigrationDecision1.md`). An LLM call breaks that premise in one
specific, unavoidable way: **it requires an API key** (OpenRouter) or **a network address for a
GPU host that should not be directly reachable from every employee's browser** (Ollama). Neither
can be embedded in browser-shipped JavaScript - that is a textbook OWASP secrets-in-client-code
exposure, and for Ollama specifically it would also mean exposing an internal GPU server directly
to the public internet.

**This means: adding an LLM feature requires reintroducing a backend for this one feature.**
That is not a step backward from the migration work already done - the deterministic generation
and export paths stay exactly as they are today (see section 7, "hybrid" design). It is a new,
additive capability that needs its own server-side component.

## 4. The backend slot already exists and is unused - use it

This is the most important architectural finding in this document: **the XYZ template this app
already runs on has a fully-documented, sanctioned mechanism for exactly this situation**, and it
has been present-but-dormant since the migration:

- `app/server.mjs` (XYZ-owned, untouched) already proxies `/_api/*` to a configurable
  `BACKEND_URL`, injecting an OAuth client-credentials Bearer token server-side. The browser
  never sees the token.
- `AGENTS.md` (already in this repository) documents the exact setup: deploy a separate XYZ
  **API-category service**, wire `BACKEND_URL` + `OAUTH_CLIENT_ID`/`OAUTH_CLIENT_SECRET`/
  `OAUTH_AUDIENCE`/`OAUTH_SCOPE`/`OAUTH_TOKEN_URL` as secrets on **this** frontend service, and
  call it from the browser only via `/_api/...`.
- This app used to have exactly this shape for its own generation/export calls before this
  migration (the old `app/src/api/client.ts`) - it was deleted because Architecture B no longer
  needed *any* backend. Reintroducing a client for this one new feature is not "undoing" that
  work; it is scoping a backend need to precisely the one part of the app that has one.

**Recommendation: do not fight the platform, and do not invent a new integration pattern.** Stand
up a small new XYZ API service (a thin Node/Express or similar service - the LLM logic itself
is a few HTTP calls plus prompt templates, not a heavy service) that holds the LLM provider
credentials, and connect this frontend to it through the existing, already-documented `/_api`
proxy. This is genuinely the path of least resistance given what this specific XYZ platform
already provides.

## 5. Target architecture

```text
Browser (this app, unchanged deterministic path stays as-is)
  |
  |  /_api/llm/gap-analysis   (new)
  |  /_api/llm/generate        (new)
  |  /_api/llm/review          (new, optional, phase 2)
  v
app/server.mjs  (XYZ-owned, UNCHANGED) -- proxies /_api/* to BACKEND_URL, injects OAuth token
  |
  v
New XYZ "API" service: specpilot-llm-api  (new, small, this project's responsibility)
  |  holds LLM_PROVIDER, LLM_BASE_URL, LLM_API_KEY as its own secrets (never in the browser)
  |  uses one OpenAI-compatible client, pointed at:
  |
  +-- LLM_PROVIDER=openrouter  -> https://openrouter.ai/api/v1  (cloud, ~400+ models, fastest to start)
  +-- LLM_PROVIDER=ollama      -> http://<internal-ollama-host>:11434/v1  (self-hosted, zero data egress)
```

The **frontend never talks to OpenRouter or Ollama directly, and never sees the API key.** The
new backend service is the only thing that knows which provider is active; swapping providers is
a config/secret change on that service, not a frontend code change, because both providers speak
the same OpenAI-compatible wire format.

**Why keep a config toggle instead of committing to one now:** this directly answers "can it be a
local model" - yes, by pointing the same backend at an internal Ollama host instead of
OpenRouter, with no other code change. This lets you start fast (OpenRouter, section 8 phase 1)
and move to fully local (Ollama) before any confidential product data is used with it, without
re-architecting anything.

## 6. Keeping the LLM inside the existing document contract, not around it

`docs/Spec.md`'s hard requirements - `FR-PRD-SECTIONS` (9 named sections in order),
`FR-TRS-SECTIONS` (12 named sections in order), `FR-UX-SEGMENTS` (2 named segments) - must not
become "whatever the model feels like producing." The existing `PRD_SECTIONS` / `TRS_SECTIONS` /
`UX_SEGMENTS` constant tuples in `generation/prdGen.ts` / `trsGen.ts` / `uxGen.ts` already
enumerate the exact contract. The LLM's job should be **constrained to fill that contract**, not
replace it:

```text
response_format: {
  type: "json_schema",
  json_schema: {
    name: "prd_sections",
    strict: true,
    schema: {
      type: "object",
      properties: {
        "Problem Statement": { type: "string" },
        "Business Case": { type: "string" },
        ... one property per PRD_SECTIONS entry, in the same order ...
      },
      required: [ ...PRD_SECTIONS... ],
      additionalProperties: false
    }
  }
}
```

This is directly implementable with either provider (OpenRouter's `response_format`, Ollama's
`format`) and derivable programmatically from the existing section-name tuples, so the contract
cannot silently drift between the deterministic and LLM-assisted paths. The deterministic
generators remain the schema's single source of truth for section names/order even after this
change.

## 7. Proposed feature flow (maps the pasted conversation onto the real app)

```text
Step 0 - Mode choice (new)
  InputForm gains a toggle: "Quick (deterministic)" vs "Guided (AI-assisted)".
  Quick mode = exactly what exists today, completely unchanged, always available, works offline,
  zero cost, zero latency, zero data leaves the browser. This is the fallback/safety net.

Step 1 - Guided questionnaire (new, per selected DocType)
  Replace/augment the current 2-field form with a small set of doc-type-specific structured
  questions (still all client-side, no LLM call yet) - e.g. for PRD: target users, key
  constraints, non-goals; for TRS: known integrations, data sensitivity, deployment target;
  for UX: primary user journey, platforms.

Step 2 - Gap analysis (new backend call)
  App -> POST /_api/llm/gap-analysis { productTitle, productDetails, answers, selectedTypes }
  Backend prompt: "Review the collected information. Identify missing requirements, ambiguities,
  and contradictions. Ask at most 5 essential clarifying questions." (constrained to a JSON
  schema: { questions: [{ id, question, relatedField }], maxItems: 5 })
  If the model returns zero questions, skip straight to Step 4.

Step 3 - Follow-up answers (new, client-side)
  Render the returned questions as additional inputs; user answers or explicitly skips.

Step 4 - Generation (new backend call, replaces the deterministic call for Guided mode only)
  App -> POST /_api/llm/generate { ...all collected answers..., selectedTypes }
  Backend prompt, one call per requested DocType, each constrained by that DocType's section
  schema (section 6). Returns the same `GeneratedDocument[]` shape the app already uses, so
  `App.tsx`, `OutputView.tsx`, and `ExportControls.tsx` need **no changes** downstream of
  `generate()` - only the function that produces `GenerationResponse` changes, not anything that
  consumes it.

Step 5 - Optional quality-check pass (new, phase 2)
  A "Review with AI" button per document, sending the current (possibly user-edited) content back
  to the backend with a prompt: "Review this <PRD|TRS|UX> as a Senior Product Manager. Identify
  missing sections, risks, incomplete requirements." Returned as a list of flagged issues shown
  alongside the document, not an automatic silent rewrite - the user stays in control of edits
  (consistent with the existing FR-EDIT-UPDATE / FR-EDIT-PERSISTVIEW requirements).

Step 6 - RAG (explicitly out of scope for this plan, noted for later)
  Once the above is live and proven useful, a vector store (FAISS/Chroma/Qdrant) of past
  PRDs/TRSs and internal standards could be retrieved and injected into Step 4's prompt so output
  follows company conventions automatically. This adds real operational surface (an ingestion
  pipeline, a store to secure and back up) and should be a separate, later decision - not bundled
  into the first iteration.
```

## 8. Impact on the existing codebase (what changes, what does not)

| Area | Current state | Change needed |
| --- | --- | --- |
| `generation/contract.ts` | `GenerationRequestSchema` has `productTitle`, `productDetails`, `selectedTypes` | **Additive** extension: optional `answers`/`clarifications` fields. Existing fields and Quick-mode behavior stay valid and unchanged (backward compatible) |
| `generation/prdGen.ts` / `trsGen.ts` / `uxGen.ts` | Deterministic template generators | **Unchanged.** These remain the Quick-mode path and the section-name/order source of truth for the LLM's JSON schema |
| `generation/genService.ts` | Synchronous `generate()` | Unchanged for Quick mode. A new, separate async orchestrator is added for Guided mode (not a modification of the existing pure function - determinism of the existing path must not be compromised) |
| `App.tsx` | Calls `generate()` directly, synchronous | Needs a real async/pending state for Guided mode (today's `pending` flag is vestigial since generation is instant; it becomes meaningful once a real network call is involved), plus state for the new questionnaire/clarification steps |
| `app/src/api/` | Deleted this migration (had zero use once Architecture B removed the HTTP layer) | **Recreated**, this time genuinely used - a small `/_api/llm/*` client, following XYZ's own convention this time instead of the old SpecPilot `/api/*` shape |
| `InputForm.tsx` | 2 fields + checkboxes | Extended with the mode toggle and guided questions; existing quick-mode fields/behavior preserved |
| `OutputView.tsx` / `ExportControls.tsx` | Consume `GeneratedDocument[]` / edited content | **No change** - both are already decoupled from *how* documents were produced |
| New: XYZ API service (name TBD, e.g. `specpilot-llm-api`) | Does not exist | New deployable: holds `LLM_PROVIDER`/`LLM_BASE_URL`/`LLM_API_KEY`, exposes `/gap-analysis`, `/generate`, `/review` |
| `docs/Spec.md` Non-Goals | "generation is deterministic... no external LLM" | Needs an explicit, deliberate update once you decide to proceed (see decision #1) - e.g. reframing determinism as the Quick-mode guarantee, not an app-wide constraint |

## 9. Decisions needed from you before implementation starts

1. **Confirm the determinism non-goal is being deliberately superseded** (not silently dropped) -
   and confirm Quick mode (today's exact behavior) remains available as a fallback, per section 7
   Step 0. This is a product decision, not a technical one.
   ANS: Yes I want to make it LLM based, going away from the template structure.
2. **OpenRouter vs. Ollama for the first working version**, independent of model choice (section
   2): OpenRouter is faster to stand up (no GPU procurement, pay-as-you-go, instantly available
   model catalog) but sends prompts outside the company network to OpenRouter + an underlying
   provider. Ollama is slower to stand up (needs a provisioned/allocated GPU host) but keeps 100%
   of data in-house. Given the "company confidential" concern raised in the pasted conversation,
   **the safe default recommendation is: prototype against OpenRouter with clearly non-confidential
   test data first (to validate prompt quality/UX quickly), then move the same backend to an
   internal Ollama host before any real/confidential product descriptions are used with it** -
   the config-swap design in section 5 makes this a non-event technically.
   ANS: Yes free version (please do a web search on whether this still means we can filter based on models that don't learn on the data), and also check if they're open source. It has to strictly be open source. But if the former is not true (filtering thing), then that's okay. It's a good to have though. Any other options open source+no training on data for free?
3. **Model choice**, once the OpenRouter-vs-Ollama question is answered - Qwen3 (32B class) is the
   conversation's own top recommendation and is well-suited to structured document generation on
   either provider; this plan does not need to lock in a specific parameter count today.
   ANS: Not sure about this as I have answered above. Please tell me based on what I've mentioned.
4. **Who owns/deploys the new XYZ API service** - this is a second deployable service with its
   own XYZ onboarding, secrets, and OAuth credential setup (per `AGENTS.md`), not a change to
   this frontend's existing deployment.
   ANS: I will make my manager generate the keys. Cause its her app. I also have admin access, so I can update all the secrets. I created the app and its working properly in XYZ in its current state at the moment (with your updates).
5. **Budget/quota expectations if OpenRouter is chosen** - per-request cost scales with the chosen
   model's per-token price and typical PRD/TRS/UX length; this should be estimated against a
   specific model once picked, not assumed.
   ANS: Planning on using free API as mentioned above.
6. **Whether the Step 5 review pass ships in v1** or is deferred - it adds real value per the
   pasted conversation but is independent of the core generation improvement and can safely be a
   phase 2 addition without blocking phase 1.
   ANS: For now let's work on things till Step 4. Let this and RAG be a future consideration (I will ask my manager if we need it).

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Confidential product data sent to a third-party cloud provider before a data-handling decision is made | Medium if OpenRouter is used carelessly | High | Explicit sign-off in decision #2; start with non-confidential test data; use OpenRouter's data-policy filtering (restrict to non-training / zero-retention providers) as an interim control if OpenRouter is used with any real data before an Ollama migration |
| LLM output breaks the exact section name/order contract (`FR-PRD-SECTIONS` etc.) | Medium without constraints, low with them | High (silently fails acceptance tests) | Enforce JSON-schema-constrained output per section (section 6); validate the response against the same `PRD_SECTIONS`/`TRS_SECTIONS`/`UX_SEGMENTS` tuples before accepting it; fall back to Quick mode on validation failure |
| Prompt injection via free-text `productDetails` (a user could try to make the model ignore instructions or leak the system prompt) | Medium | Medium | Keep a strict system/user message separation; do not put secrets in any prompt; validate/re-schema-check all model output before rendering; treat model output as untrusted text (already true for the deterministic path's HTML/PDF escaping, which does not change) |
| New backend service becomes a second thing to operate, monitor, and secure | High (inherent to the design) | Medium | Keep it intentionally small (a handful of HTTP routes + prompt templates, no heavy framework needed); this is the accepted cost of the OWASP-required "no secrets in the browser" constraint, not avoidable |
| Real network/model latency (seconds, not milliseconds) breaks user expectations set by the current instant Quick mode | High | Low-Medium | Guided mode gets its own visible loading/progress state (section 8); `NFR-PERF-GENLATENCY`'s existing "10s" assumption should be explicitly revisited for Guided mode as part of decision #1's Spec.md update |
| Provider/model outage or rate-limiting | Medium | Medium | Keep Quick mode always available as a working fallback; add basic timeout + one retry in the new backend service |
| Tests become flaky/slow if they hit a real LLM | High if untreated | Medium | The new backend's LLM client should be mocked/stubbed in tests (same principle already used for `fetch` in the current test suite); Quick-mode tests are entirely unaffected since that code path does not change |

## 11. Suggested phased rollout (for a later, separate implementation plan)

1. **Spike:** stand up the minimal XYZ API service with a single `/generate` endpoint, wired to
   OpenRouter, producing a schema-constrained PRD only, called manually (not yet wired into the
   UI) - prove the JSON-schema-constrained output actually holds `FR-PRD-SECTIONS`'s contract
   before building anything else.
2. **Backend hookup:** wire the new service into XYZ (`BACKEND_URL` + OAuth secrets per
   `AGENTS.md`), recreate a minimal `/_api` client in the frontend, add the Guided-mode toggle and
   loading state, connect `/generate` end-to-end for all three doc types.
3. **Gap analysis:** add `/gap-analysis` and the follow-up-question UI step.
4. **Provider portability check:** point the same backend at an internal Ollama host and confirm
   parity, closing decision #2 for real if confidentiality requires it.
5. **Review pass (optional):** add `/review` and its UI affordance.
6. **RAG (separate future decision):** only after the above is live and validated as useful.

This document intentionally stops at "here is the plan" - no implementation task breakdown, task
sequencing detail, or code has been produced, per your instruction. Once you have made the
decisions in section 9, the next step would be a dedicated implementation plan (à la
`docs/XYZAnalysis1.md`) for whichever phase you want to start with.
