# Enhancement Build Plan - LLM-Assisted Generation (Steps 0-4)

> **⚠️ SUPERSEDED by `docs/EnhancementBuildPlan2.md`.** This document describes the OpenRouter-
> backed design, which was scrapped in favor of an internal Cluster-backed design. Kept only as
> historical record - do not implement anything from this file. See `docs/EnhancementBuildPlan2.md`
> and `docs/EnhancementToDo2.md` for the current design.

## Status

This is the implementation-ready plan, incorporating every constraint you gave in your last
message. It supersedes the open questions in `docs/Enhancements1.md` section 5 - those are now
answered below, not left open. This document is written so a Builder agent can execute it without
re-deriving any of the reasoning in `docs/Enhancements0.md` / `docs/Enhancements1.md`.

## Revision - architecture pivot: single app, no OAuth, no separate backend

**This section supersedes the original "separate XYZ API-category service" design below
wherever the two conflict.** Per your explicit direction:

- **OAuth clarified and skipped.** The `OAUTH_*` variables in this template are for
  **service-to-service (machine-to-machine, client-credentials) authentication between this
  app's own server and a separately-deployed backend** - they have nothing to do with end-user
  login, and this app has no user accounts. Per the template's own documented behavior
  (`docs/GithubTemplateInfo.md`: "If `OAUTH_CLIENT_ID` or `OAUTH_CLIENT_SECRET` are not set, the
  proxy still works - it just forwards requests without adding an Authorization header"), OAuth
  was always optional at the proxy layer. It is now moot for this feature specifically, because
  the LLM routes are handled **in this same process** - there is no second service to
  authenticate to.
- **No separate XYZ API-category service.** The two routes (`/_api/gap-analysis`,
  `/_api/generate`) are implemented **directly inside this app's existing `server.mjs`
  (production) and `vite.config.ts` (dev)**, registered before the generic `/_api` ->
  `BACKEND_URL` proxy so they're handled locally and never reach it. Deploying this feature is
  now just pushing this repository - no second app onboarding.
- **Deliberate reversal of the original constraint #6** ("nothing about `server.mjs`/
  `vite.config.ts` changes"): both files now contain new code (see below). This is a conscious
  trade-off, not an oversight - flagging it plainly: `server.mjs` and `vite.config.ts` are
  XYZ-template-owned files, and if XYZ ships a template upgrade to either file in the future,
  this app's LLM routes would need to be manually re-applied on top of the upgraded file. This is
  the accepted cost of avoiding a second deployable.
- **Hard constraint discovered and respected:** `docker/node20.11/Dockerfile`'s production stage
  only copies `server.mjs` itself into the runtime image (`COPY --from=src server.mjs .`), not
  the rest of `app/`. This means the LLM logic **cannot** live in a separate module file in
  production - it must be self-contained inside `server.mjs`. The Dockerfile was **not**
  modified to accommodate this; the constraint was worked around instead, per your instruction
  to leave Docker/deployment files untouched.
- **Secrets, now simpler:** only `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`,
  `OPENROUTER_MODEL_CANDIDATES`, and `LLM_REQUEST_TIMEOUT_MS` are needed, all on **this single
  app's** XYZ secrets. No `BACKEND_URL`, no `OAUTH_*` variables, no second app's secrets.
- **Status: implemented and manually verified.** Both routes are live in `server.mjs` and
  `vite.config.ts`'s dev plugin. Verified in the dev server: with no `OPENROUTER_API_KEY` set,
  both routes correctly return `503 { "error": "LLM_UNAVAILABLE" }` (visible in server logs and
  the browser's network tab), and the frontend falls back to the deterministic generator exactly
  as designed.

**Your constraints, restated precisely so nothing drifts during implementation:**

1. Only free, certainly-open-source models are acceptable. **Never fall back to a paid model or a
   closed-source model, under any circumstance.**
2. `data_collection: "deny"` (OpenRouter's no-training enforcement) is attempted on every request,
   but is a **soft preference** - if it cannot be satisfied, drop it and proceed with the same
   free/open-source model anyway. It is not allowed to block a request or trigger a fallback by
   itself.
3. If the LLM path is unavailable for any reason (network, all candidate models exhausted, backend
   service down), fall back to the **existing deterministic generator** (`prdGen`/`trsGen`/
   `uxGen`) - silently usable, not a paid escalation, not an error shown to the user as a dead end.
4. No naming preference for the new backend service - **moot after the revision above**; there is
   no separate service.
5. Scope is Steps 0-4 from `docs/Enhancements0.md` section 7 only (questionnaire -> gap analysis
   -> follow-ups -> generation). No review pass, no RAG.
6. **Superseded by the revision above:** `app/server.mjs` and `app/vite.config.ts` now contain new
   LLM-route code, added deliberately, in place of the original "do not touch these" constraint.
   `docker/`, `deployment/`, `docker-bake.hcl` remain untouched.

---

## 1. Two open questions from Enhancements1, now answered

- **Fallback behavior:** deterministic generator, confirmed. It is simple to wire in because it
  already exists, is synchronous, and requires no network - it is the natural "this always works"
  path.
- **New service name:** `specpilot-ai-api` (a suggestion only - rename freely at deploy time; no
  code in this repository hardcodes this name anywhere except the `BACKEND_URL` secret value,
  which is a deployment-time configuration value, not source code).

## 2. Architecture (final)

```text
Browser (this repo, app/src)
  |
  |  POST /_api/gap-analysis   { productTitle, productDetails, selectedTypes, answers }
  |  POST /_api/generate       { docType, productTitle, productDetails, answers, clarifications, sections }
  v
app/server.mjs  (XYZ-owned, UNCHANGED)  -- proxies /_api/* to BACKEND_URL, injects OAuth token
  |
  v
New XYZ API-category service: specpilot-ai-api  (separate deployable, NOT in this repository)
  |  owns OPENROUTER_API_KEY and the ordered free-model candidate list as its own secrets/config
  |  calls https://openrouter.ai/api/v1/chat/completions (OpenAI-compatible)
  |  is a generic "constrained LLM gateway" - it has ZERO hardcoded knowledge of PRD/TRS/UX
  |  section names; the caller (this frontend) supplies the JSON schema/section list per request
  v
OpenRouter -> whichever free, open-source model (Qwen/DeepSeek-class, see section 5) is configured
```

**Why the backend has no product-specific knowledge:** the alternative (duplicating
`PRD_SECTIONS`/`TRS_SECTIONS`/`UX_SEGMENTS` inside the new service, which lives in a separate
repository) would create a silent-drift risk - if this repo's section names ever change, the
backend's copy would go stale with no compiler or test to catch it. Instead, this frontend (which
already owns those tuples) sends the section list as part of each `/generate` request, and the
backend derives its `response_format` JSON schema generically at request time. This keeps
`generation/prdGen.ts` / `trsGen.ts` / `uxGen.ts` as the **single** source of truth for section
names/order, exactly as `docs/Enhancements0.md` section 6 required, with no duplication anywhere.

## 3. Failure cascade (exact behavior, in order)

```text
1. Gap analysis call (/_api/gap-analysis)
   -> succeeds with questions:  show them, wait for answers/skip, then go to step 2
   -> succeeds with zero questions: go straight to step 2
   -> fails for ANY reason (timeout, 5xx, network): go straight to step 2, log nothing user-facing
      (gap analysis is a nice-to-have; its failure must never block generation)

2. Generation call, once per selected DocType (/_api/generate)
   -> succeeds: map the returned sections into a GeneratedDocument (source: "llm")
   -> fails for ANY reason (timeout, 5xx, all free candidates exhausted, network,
      backend unreachable): call the local deterministic buildPrd/buildTrs/buildUx for that
      one DocType instead (source: "fallback") - never retried against a paid model, never
      surfaced as a blocking error to the user
```

Each `DocType` is generated independently, so if (for example) PRD generation succeeds via the LLM
and TRS generation fails, only TRS falls back - PRD is not regenerated or downgraded.

## 4. LLM routes contract (implemented directly in `app/server.mjs` and `app/vite.config.ts` -
see the Revision section above; **implemented and manually verified**)

Two routes, no state, no database, no product-specific knowledge, registered before the generic
`/_api` proxy so they're handled locally and never reach it. No separate `/health` route was
added - this shares the frontend app's own existing process and liveness.

### `POST /gap-analysis`

Request:

```json
{
  "productTitle": "Acme",
  "productDetails": "A tool for teams to collaborate on documents.",
  "selectedTypes": ["PRD", "TRS"],
  "answers": { "prd_target_users": "Product managers", "trs_integrations": "Slack, Jira" }
}
```

Response (schema-constrained, `maxItems: 5`):

```json
{ "questions": [
  { "id": "q1", "question": "Should this support single sign-on?", "relatedField": "trs_integrations" }
] }
```

Or `{ "questions": [] }` when nothing is missing/ambiguous.

System prompt (use verbatim, adjust only for formatting needs of the chosen SDK):

```text
You are a requirements analyst reviewing a product description before it is turned into
formal documentation. Identify missing requirements, ambiguities, and contradictions in the
information provided. Ask at most 5 essential clarifying questions. If the information is
already sufficient, return an empty question list. Do not ask about anything already answered
in the provided fields. Be concise - one short question per item.
```

`response_format` JSON schema (this one IS fixed/hardcoded server-side - it is generic, not
tied to any document type):

```json
{
  "type": "json_schema",
  "json_schema": {
    "name": "gap_analysis",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "questions": {
          "type": "array",
          "maxItems": 5,
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "question": { "type": "string" },
              "relatedField": { "type": "string" }
            },
            "required": ["id", "question"],
            "additionalProperties": false
          }
        }
      },
      "required": ["questions"],
      "additionalProperties": false
    }
  }
}
```

### `POST /generate`

Request:

```json
{
  "docType": "PRD",
  "productTitle": "Acme",
  "productDetails": "A tool for teams to collaborate on documents.",
  "answers": { "prd_target_users": "Product managers" },
  "clarifications": { "q1": "Yes, SSO is required." },
  "sections": [
    "Problem Statement", "Business Case", "Proposed Solution",
    "Functional Requirements", "User Personas and their Journey",
    "Exclusions", "Success Criteria", "Assumptions", "Risks and Dependencies"
  ]
}
```

Response (schema-constrained, one property per entry in the request's `sections`, in the same
order, all required, `additionalProperties: false` - built generically server-side from the
request's own `sections` array, not from any hardcoded list):

```json
{ "sections": {
  "Problem Statement": "...",
  "Business Case": "...",
  "...": "..."
} }
```

System prompt (use verbatim; `{docType}` and the section list are interpolated per request):

```text
You are a senior product/technical writer generating a {docType} document. Use the product
title, details, and answers provided to write clear, specific, professional content for each
requested section. Do not invent section names beyond what is requested. Write plain prose
(no markdown headings inside section values - headings are added by the caller). Be specific
to the described product; do not use generic placeholder language when concrete information
is available in the inputs.
```

`response_format` JSON schema is built at request time from the request's `sections` array:

```text
schema.properties[name] = { type: "string" }   for each name in request.sections
schema.required = request.sections              (all sections mandatory)
schema.additionalProperties = false
```

### Model selection and resilience logic (implemented in both `server.mjs` and `vite.config.ts`'s
dev plugin - deliberately duplicated, not shared via import, because production's `server.mjs`
must stay self-contained per the Dockerfile constraint in the Revision section, and importing it
into `vite.config.ts` would trigger its unconditional `app.listen()` side effect)

```text
config: OPENROUTER_MODEL_CANDIDATES = ordered list of free, open-source model slugs
        (populated at deploy time - see section 5 for how to choose them; never includes
        a paid or closed-source slug)

function callLLM(messages, schema):
  for model in OPENROUTER_MODEL_CANDIDATES:
    try:
      response = openRouterClient.chatCompletions.create({
        model,
        messages,
        response_format: schema,
        provider: { data_collection: "deny" },   # soft preference, see below
      })
      return response
    catch (error where error indicates "no compliant provider for data_collection: deny"):
      try:
        response = openRouterClient.chatCompletions.create({
          model,                                  # SAME free/open-source model, no substitution
          messages,
          response_format: schema,
          # provider.data_collection omitted this attempt - the one thing we were told to relax
        })
        return response
      catch (error):
        continue to next candidate
    catch (any other error - timeout, 429, 5xx, retired model):
      continue to next candidate
  # every candidate exhausted:
  throw LLMUnavailableError   # never substitutes a paid model - this error is what tells the
                              # frontend to use the deterministic fallback
```

Return a distinct, checkable error (e.g. HTTP 503 with `{ "error": "LLM_UNAVAILABLE" }`) when all
candidates are exhausted, so the frontend can react deterministically rather than guessing from a
generic failure.

**Logging:** log which candidate model/provider served each request, latency, and success/failure
- never log `productTitle`, `productDetails`, `answers`, or `clarifications` content itself, to
avoid the service's own logs becoming an unintended store of potentially sensitive product
descriptions.

### Secrets and environment variables (this single app's XYZ secrets - no second app, no OAuth)

| Name | Type | Required now? | Notes |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | Secret | Placeholder for now, real value in ~2 days | See "dummy-value guidance" below |
| `OPENROUTER_BASE_URL` | Config | Yes, has a safe default | Default `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL_CANDIDATES` | Config | Yes, can be set for real right now | Ordered list from section 5 - choosing candidates does **not** require a working API key, since browsing OpenRouter's model catalog is unauthenticated |
| `LLM_REQUEST_TIMEOUT_MS` | Config | Yes, has a safe default | Recommend `20000` |

**Dummy-value guidance for `OPENROUTER_API_KEY` (you don't have the real key yet):**
set it to an obviously-fake placeholder string (e.g. `REPLACE_WITH_REAL_OPENROUTER_KEY`) in
this app's XYZ Secrets right now. This is safe and does not block anything:

- No SDK or build step validates the key's format at compile time or at service startup - it is
  only read and sent as an `Authorization` header when an actual OpenRouter call is made.
- With a placeholder key, every real OpenRouter call will fail authentication (401). The
  resilience logic above already treats any such failure as "this candidate failed," tries the
  next candidate, and - once every candidate has failed - throws `LLMUnavailableError`, which is
  exactly the signal that makes the frontend fall back to the deterministic generator (section 3).
- **Practically, this means the entire feature - both routes, the full frontend
  orchestration, the guided questionnaire, the fallback notice - can be built, deployed, and
  tested end-to-end right now**, always taking the (already-correct, already-working)
  deterministic path. This is a genuine test of the whole failure cascade, not just a workaround.
- Do not leave the value empty/unset if the chosen HTTP/SDK client throws on a missing key at
  construction time - always use a non-empty placeholder string, never a real-looking one.

**Where the real key goes once your manager provides it:** XYZ -> **this app's** Secrets ->
set `OPENROUTER_API_KEY` to the real value -> redeploy/sync. There is no second app and no
`BACKEND_URL`/OAuth secrets involved for this feature at all. Never commit the real key (or the
placeholder, if it could be mistaken for real) into source control - XYZ Secrets only.

## 5. Choosing the actual model candidates (do this once, at deploy time, not hardcoded here)

Per `docs/Enhancements1.md` section 3's finding, the free-model catalog on OpenRouter rotates, and
I could not confirm a specific live slug during planning. **Before deploying the backend
service**, whoever sets `OPENROUTER_MODEL_CANDIDATES` must:

1. Fetch `https://openrouter.ai/api/v1/models` (or browse `openrouter.ai/models?max_price=0`).
2. Keep only entries whose slug ends in `:free`.
3. Keep only entries whose underlying model license is genuinely open-source - prefer **Qwen**
   and **DeepSeek** families (Apache-2.0/MIT-class licenses) over Meta Llama (custom community
   license) or Google Gemma (custom license); only consider Llama/Gemma `:free` variants if no
   Qwen/DeepSeek `:free` variant exists at all.
4. Keep only entries whose model page lists `response_format`/structured-output support under
   `supported_parameters` (required for section 4's schema-constrained calls).
5. Put 2-4 surviving candidates into `OPENROUTER_MODEL_CANDIDATES`, most-preferred first. If
   **zero** candidates survive steps 2-4, do not deploy the LLM path yet - the deterministic
   generator remains the only path in that case, which is an acceptable, already-working state
   per your constraint that nothing is allowed to fall back to a paid or closed-source model.
6. Re-check this list periodically (the free catalog is confirmed to rotate) - this is an
   operational task, not a one-time decision.

## 6. Changes required in this repository (frontend only)

| File | Change |
| --- | --- |
| `app/src/generation/contract.ts` | Additive only: add `answers?: Record<string, string>` and `clarifications?: Record<string, string>` to `GenerationRequestSchema`. Add new types `ClarificationQuestion`, `GapAnalysisResponse`. Existing fields/behavior unchanged - the deterministic path still works with none of these set |
| `app/src/generation/sectionSchema.ts` (new) | `sectionNamesFor(docType): string[]` (returns `PRD_SECTIONS`/`TRS_SECTIONS`/`UX_SEGMENTS`) plus `buildGeneratedDocument(productTitle, docType, sections: Record<string,string>): GeneratedDocument`, which must reproduce each generator's **exact existing** heading/title convention, not one generic format (verified against current source): `title` is always `"${productTitle.trim()} — ${LONG_NAME}"` where `LONG_NAME` is `"Product Requirements Document"` / `"Technical Requirements Specification"` / `"UX Design Mockups"`. For PRD/TRS, `content` is `"# ${productTitle.trim()} ${docType}\n\n"` followed by each section as `"## {index+1}. {name}\n\n{body}"` joined with `"\n\n"`, plus a trailing `"\n"` - matching `prdGen.ts`/`trsGen.ts` exactly. For UX, headings are **not** numbered (`"## {segment}"`, no index prefix) - matching `uxGen.ts`'s existing array-join shape, since its two segments (`"User Journeys for personas"`, `"UI Design Mockups"`) never had numbering even in the deterministic version. Getting this right matters only for visual/output consistency between the LLM and fallback paths - the existing tests only assert section-name presence/order in `content`, not exact heading punctuation |
| `app/src/api/llmClient.ts` (new - recreates `app/src/api/`, this time genuinely used) | `postGapAnalysis(request): Promise<GapAnalysisResponse>` and `postGenerate(request): Promise<{ sections: Record<string,string> }>`, both calling `fetch("/_api/...")` with an `AbortController`-based timeout (recommend 20s), throwing a typed error on non-2xx or timeout |
| `app/src/generation/llmGenService.ts` (new) | Orchestrates: `runGapAnalysis(request)` (catches all errors, returns `[]` on failure - implements the "fail open" cascade from section 3); `runGeneration(request, selectedTypes)` (calls `postGenerate` per type, maps success via `buildGeneratedDocument`, falls back to the local `buildPrd`/`buildTrs`/`buildUx` per type on any failure, tagging each resulting `GeneratedDocument` with an extra non-persisted `source: "llm" \| "fallback"` marker used only for the UI notice in `App.tsx`) |
| `app/src/features/input/InputForm.tsx` | Add the small guided-question fields (section 7) per selected DocType, collected into `answers` and included in the request passed to `onGenerate` |
| `app/src/features/input/ClarificationQuestions.tsx` (new) | Renders the (up to 5) questions returned by gap analysis as simple text inputs; calls back with the collected `clarifications` map when the user submits or explicitly skips |
| `app/src/App.tsx` | New orchestration: on Generate, call `runGapAnalysis` -> if it returns questions, render `ClarificationQuestions` and wait; then call `runGeneration`. Add a small non-blocking notice (e.g. `<p role="status">`) per document type that fell back, using each document's `source` marker. `pending` becomes meaningful now (real network calls) |
| `app/src/features/output/OutputView.tsx` | **No change** |
| `app/src/features/export/ExportControls.tsx` | **No change** |
| `app/vite.config.ts`, `app/server.mjs`, `docker/`, `deployment/`, `docker-bake.hcl` | **No change**, per your explicit constraint |

## 7. Guided questionnaire content (exact, per DocType - keep this small and pragmatic)

| DocType | Question id | Prompt shown to user |
| --- | --- | --- |
| PRD | `prd_target_users` | "Who are the primary target users of this product?" |
| PRD | `prd_constraints` | "Any known constraints or explicit non-goals?" |
| PRD | `prd_success_metric` | "How will you know this product succeeded?" |
| TRS | `trs_integrations` | "Any known systems/integrations this must work with?" |
| TRS | `trs_data_sensitivity` | "Does this handle sensitive or regulated data?" |
| TRS | `trs_deployment` | "Where will this be deployed/run (cloud, on-prem, mobile, etc.)?" |
| UX | `ux_journey` | "What is the primary user journey or entry point?" |
| UX | `ux_platform` | "What platform(s) - web, mobile, desktop?" |

All optional (empty answers are allowed and simply mean the LLM has less context - this does not
block generation, consistent with keeping the deterministic path as a true no-input-required
fallback).

## 8. Testing changes required in this repository

- Mock `app/src/api/llmClient.ts` in all tests - never call a real network endpoint from the test
  suite (same principle already used for the deleted HTTP layer's tests).
- Add tests for: gap-analysis failure results in zero questions and generation still proceeds;
  per-DocType generation failure results in that one document having `source: "fallback"` and
  content identical in shape to the deterministic generator's own output; `sectionSchema.ts`'s
  `buildGeneratedDocument` produces output containing the same section headings/order as
  `PRD_SECTIONS`/`TRS_SECTIONS`/`UX_SEGMENTS` (regression protection for the exact-order
  requirement); no test should ever depend on OpenRouter or the new backend actually being
  reachable.
- Existing deterministic-path tests (`generation/*.test.ts`, `export/*.test.ts`) are unaffected and
  must continue passing unchanged.

## 9. Rollout order for Builder

1. Confirm at least one currently-free, open-source, structured-output-capable model on OpenRouter
   (section 5) before enabling the routes for real - if none exist right now, that's fine; the
   routes already degrade cleanly to `LLM_UNAVAILABLE` -> deterministic fallback with no candidates
   configured. Do not substitute a paid or closed-source model to "make it work."
2. **Done:** the two routes are implemented directly in `app/server.mjs` (production) and
   `app/vite.config.ts` (dev plugin) - no separate service, no onboarding. Set
   `OPENROUTER_API_KEY`/`OPENROUTER_MODEL_CANDIDATES` on **this app's** XYZ secrets whenever the
   real key is available; a placeholder is fine until then (see "dummy-value guidance" above).
3. **Not needed:** no `BACKEND_URL`/OAuth wiring - there is no second app to authenticate to.
4. **Done:** the frontend changes in section 6 (`contract.ts` -> `sectionSchema.ts` ->
   `api/llmClient.ts` -> `generation/llmGenService.ts` -> `InputForm.tsx` +
   `ClarificationQuestions.tsx` -> `App.tsx` wiring).
5. **Done:** the tests in section 8.
6. **Done, manually verified** in the dev server: with no `OPENROUTER_API_KEY` configured, both
   routes correctly return `503 { "error": "LLM_UNAVAILABLE" }` (visible in server logs and the
   browser network tab), and generation falls back to the deterministic generator with the
   expected notice, no error blocking the user. Once a real key + model candidates are added,
   re-verify a full generate actually returns LLM-authored content instead of falling back.
7. Run the existing gate: `npm run lint`, `tsc -b`, `npm run build`, `npm test` - all confirmed
   green (see `docs/EnhancementToDo.md` for the exact validation record).
8. Only after the above is working end-to-end: update `docs/ArchitectureUpdated.md` and
   `docs/FlowUpdated.md` to describe the new flow. Do not update them speculatively before the
   implementation is real - they should keep describing the *current* app until this ships.

## 10. Explicit non-goals (unchanged from Enhancements0/1, restated for this build)

- No Step 5 (AI review pass) and no RAG in this build.
- No user-facing "Quick vs Guided" mode toggle - the LLM path is the primary experience; the
  deterministic generator is an invisible reliability fallback, not a competing option in the UI.
- Never fall back to a paid model or a closed-source model, at any layer, under any failure
  condition - the deterministic generator is the only fallback.
- `data_collection: "deny"` is best-effort per section 4 - its absence is never a reason to fail a
  request or change which model is used.
- No changes to `docker/`, `deployment/`, or `docker-bake.hcl`. `app/server.mjs` and
  `app/vite.config.ts` **do** now contain new LLM-route code - a deliberate, documented exception
  to the original constraint (see the Revision section), not an oversight.
