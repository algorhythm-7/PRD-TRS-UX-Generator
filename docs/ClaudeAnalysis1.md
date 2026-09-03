# Claude Analysis 1 — Gemini 404 Root Cause & Remediation Roadmap

> **Status:** Read-only audit. No source files were modified in producing this document.
> **Scope:** `app/server.mjs` (production LLM path), `app/vite.config.ts` (dev LLM path,
> `createLlmDevPlugin`), `app/.env.example`, `app/src/api/llmClient.ts`, `app/package.json`,
> and everything that touches Gemini model names, the `@google/generative-ai` SDK, or
> `/_api/*` LLM request/response handling.
> **Reported symptom:**
> ```
> [llm-dev] Gemini enabled - model: gemini-2.5-flash
> [llm-dev] Gemini (model=gemini-2.5-flash, schema=true) failed: GoogleGenerativeAIFetchError:
> [GoogleGenerativeAI Error]: Error fetching from .../v1beta/models/gemini-2.5-flash:generateContent: [404 Not Found]
> ```

---

## 1. Audit Findings

### 1.1 Root cause of the reported 404 — dev/prod model-default mismatch

`GEMINI_MODEL` has **two different hardcoded defaults** in the two places this pipeline is
deliberately duplicated (per `docs/NewPersonalPlan.md` §2.3 — `server.mjs` is copied alone into
the Docker image and cannot import from elsewhere, so `vite.config.ts`'s dev plugin re-implements
the same logic):

| File | Line | Default when `GEMINI_MODEL` env var is unset |
|---|---|---|
| `app/server.mjs` | 31 | `"gemini-3.6-flash"` |
| `app/vite.config.ts` (`createLlmDevPlugin`) | 874 | `"gemini-2.5-flash"` |

The terminal log (`[llm-dev] Gemini enabled - model: gemini-2.5-flash`) confirms the dev server
was running **without `GEMINI_MODEL` set in `app/.env`**, so it fell through to the *dev-only*
default of `"gemini-2.5-flash"` — which is not the value the project's own `app/.env.example`
recommends (`gemini-3.6-flash`), and not what production (`server.mjs`) would have defaulted to
in the same scenario. This is a straightforward configuration-drift bug from the two files being
hand-edited independently.

`gemini-2.5-flash` is still a real, listed model ID as of this writing, so the 404 is not
necessarily proof the model was deleted — but see §1.2/§1.3 for why it's still the wrong thing to
depend on, and §1.4 for a second, independent reason the exact same call can 404 regardless of
which model string is used.

### 1.2 The hardcoded fallback/retry list contains an already-confirmed-dead model

`callGemini` (duplicated in both files) builds a **fixed candidate list** it walks through on
failure, independent of whatever `GEMINI_MODEL` is configured to:

```js
// app/server.mjs:139-141, app/vite.config.ts:907-909 (identical)
const candidateModels = Array.from(
  new Set([modelId, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"].filter(Boolean)),
);
```

`app/.env.example` (lines 4-5) already states, in a comment written by a previous pass on this
repo: *"Do NOT use gemini-2.0-flash — it was shut down 2026-06-01 per Google's model page."* That
model is still hardcoded into the retry fallback chain in **both** files. So even once the
*primary* model default is fixed, a transient failure on the primary will cascade into at least
one guaranteed-dead fallback attempt (`gemini-2.0-flash`) before anything else is tried, wasting a
free-tier request and adding latency for no chance of success.

### 1.3 Current valid Gemini model IDs (verified against Google's live docs, not training data)

Because the assistant's training data predates the "current date" of this session by several
months in a fast-moving API surface, the following was verified live against
`ai.google.dev/gemini-api/docs/models` rather than assumed:

- **Confirmed still deprecated/retired:** `gemini-2.0-flash`, `gemini-2.0-flash-lite`.
- **Confirmed still listed as available today:** `gemini-2.5-flash`, `gemini-2.5-flash-lite`,
  `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.6-flash`,
  `gemini-3.7-flash`, `gemini-3.8-flash` (newest, shipped 2026-09-02 — one day before this
  audit; treat as very fresh/GA but not yet battle-tested by this codebase).
- **Free tier scope:** free-tier keys are limited to the **Flash / Flash-Lite** families; Pro
  models require billing. Rate limits are low (e.g. ~10 RPM / 250K TPM / 1,500 RPD class limits
  for a current Flash model) — see §1.5 for why this matters given how this codebase retries.
- **No durable "latest" alias exists to hide this churn:** `gemini-flash-latest` was a real alias
  in the past but is now itself a source of 404s (it silently kept pointing at a now-deprecated
  model). Google's current guidance is to pin an explicit versioned model ID and expect to update
  it periodically, with ~2 weeks' deprecation notice per model. **This means the fix here is not
  "pick the one correct model string forever" — it's picking a currently-valid one now and making
  the two-file duplication and fallback list easy to keep current later.**

### 1.4 A second, independent cause of the same symptom: the SDK itself is deprecated

`app/package.json` pins `@google/generative-ai: ^0.24.0` (installed: `0.24.1`). This package's
upstream GitHub repository has been renamed **`google-gemini/deprecated-generative-ai-js`** and
Google explicitly directs all users to migrate to the new unified `@google/genai` SDK — the old
one is end-of-life, not just "an older version."

This matters beyond naming: a 404 on a *currently-listed* model, coming from a client library
Google itself has archived, is consistent with the legacy SDK's request plumbing (fixed
`v1beta` REST path, older request shape) no longer being fully aligned with how the Generative
Language API resolves model routes for newer accounts/keys — independent of whether the literal
model string is spelled correctly. **This repo cannot fully rule out future 404s of this exact
shape purely by fixing model strings; the SDK dependency itself is a standing risk.** This is
scoped as its own session (Session 3) rather than bundled into the urgent fix, because it is a
larger, riskier change (touches request construction, schema conversion, and PDF multimodal
handling in both duplicated files, plus whatever tests assert on `openAiSchemaToGemini`).

### 1.5 Free-tier amplification risk in the retry loop

`callGemini` nests two loops: for each of up to 4 candidate models, it tries `withSchema: true`
then `withSchema: false` — **up to 8 real API calls for a single `/_api/generate` request** when
everything upstream is failing (e.g. during exactly the kind of outage this ticket describes).
Free-tier Flash limits are on the order of ~10 requests/minute and ~1,500/day. A handful of users
clicking "Generate" while the model default is wrong is enough to exhaust the *daily* quota via
retries alone, which then presents as more errors that look identical to the original 404 but are
actually 429 rate-limit responses — worth distinguishing when debugging.

### 1.6 Client/server timeout mismatch (secondary correctness bug, not the reported symptom)

- `app/src/api/llmClient.ts:13` — `DEFAULT_TIMEOUT_MS = 100000` (100s), the browser gives up on
  `/_api/generate` after this and throws `LlmClientError`.
- Server-side worst case: up to 4 candidate models × (20s structured attempt +
  90s plain-JSON attempt) = **~440 seconds** before `callGemini` itself gives up and the route
  falls back to the deterministic generator.
- The client aborts (via `AbortController`) more than 4 minutes before the server would have
  exhausted its own retry budget. The abort does not cancel in-flight work server-side, so a
  slow-but-eventually-successful attempt can complete after the browser has already shown a
  fallback/error state — wasted quota, and a response the UI never sees. This is not why the
  reported error happens, but it will surface as confusing intermittent behavior once model
  connectivity is otherwise fixed, so it's included as its own session rather than ignored.

### 1.7 Minor duplication-consistency issues (documentation-cleanup class, not blocking)

- `getGeminiClient()` throws a *named* `LlmUnavailableError` in `server.mjs` but a bare
  `new Error("LLM_UNAVAILABLE")` in `vite.config.ts` — inconsequential today (both are caught
  generically) but another instance of the two files silently diverging.
- `GEMINI_PDF_MODEL` inherits whatever `GEMINI_MODEL` default is active in each file, so the
  dev/prod default mismatch in §1.1 also silently affects the PDF-extraction path
  (`extractPdfViaMultimodal`), not just text generation.
- No test in `app/tests/server/newEndpoints.test.ts` (or elsewhere) pins/asserts on the actual
  model-ID strings — schema conversion is tested, model selection is not, so this class of bug
  has no regression coverage today.

### 1.8 What is already correct and does *not* need to change

- `handleLlmStatus` / `handleLlmWarmup` do **not** call Gemini at all (status is just "is
  `GEMINI_API_KEY` set", warmup is a no-op `202`) — the 20-second frontend polling interval in
  `App.tsx` (`LLM_STATUS_POLL_MS`) does not itself consume any Gemini quota. No change needed here.
- `cleanGeminiSchema` already strips `additionalProperties` and other OpenAI-schema-only fields
  before sending `responseSchema` to Gemini — schema shape conversion itself is not implicated in
  the reported 404.

---

## 2. Remediation Roadmap

The work is split into **4 independent sessions**, ordered so that Session 1 alone fully resolves
the reported error, and each later session is a self-contained improvement that does not depend on
context from the others beyond what's restated in its own prompt.

---

### Session 1: Fix the reported 404 — unify and correct the Gemini model defaults

- **Objective:** Make the dev (`vite.config.ts`) and prod (`server.mjs`) Gemini model defaults
  agree with each other and with a currently-valid, free-tier-eligible model, and remove the
  one confirmed-dead model (`gemini-2.0-flash`) from the hardcoded retry/fallback list in both
  files. This directly eliminates the exact error in the reported stack trace.
- **Files Affected:**
  - `app/server.mjs`
  - `app/vite.config.ts`
  - `app/.env.example` (verify it still matches after the change)
- **Detailed Plan:**
  1. In `app/server.mjs` line 31, confirm/set: `const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";`
  2. In `app/vite.config.ts` line 874, change the dev-plugin default from `"gemini-2.5-flash"` to
     `"gemini-3.6-flash"` so it matches production and `.env.example`.
  3. In **both** files' `candidateModels` array (`server.mjs` ~line 140, `vite.config.ts` ~line
     908), remove `"gemini-2.0-flash"` entirely (confirmed retired), and replace the fallback set
     with currently-valid Flash-family models that are NOT identical to the primary model default,
     e.g. `["gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash"]` (keep `modelId` — the
     caller-supplied/env-configured model — first in the `Set`, as today).
  4. Do the same edit in `app/server.mjs`'s `GEMINI_PDF_MODEL` fallback chain implicitly (it
     already derives from `GEMINI_MODEL` unless overridden, so no separate line change is needed
     unless `GEMINI_PDF_MODEL` is explicitly set somewhere — check `app/.env.example` and `app/.env`
     for an active override and flag it if present, but do not print `.env`'s contents).
  5. Re-read `app/.env.example` and confirm its comments (model recommendation, the "do not use
     gemini-2.0-flash" note) still match the code after the edit — update the comment text only if
     the chosen fallback set differs from what's implied there.
  6. Do not touch `app/tests/server/newEndpoints.test.ts` — it only tests schema conversion, not
     model selection, and needs no change for this fix.
  7. Verify manually: run `npm run dev` from `app/`, submit a generation request, and confirm the
     terminal log line reads `[llm-dev] Gemini enabled - model: gemini-3.6-flash` (or whatever
     final default was chosen) and that no `404 Not Found` appears for the primary attempt.
- **Copy-Paste Prompt:**
  ```
  In this repo, app/server.mjs and app/vite.config.ts each contain a duplicated Gemini LLM
  integration (this duplication is intentional — see docs/NewPersonalPlan.md §2.3 — because
  server.mjs is the only file copied into the production Docker image and cannot import from
  elsewhere; vite.config.ts's createLlmDevPlugin is the dev-server equivalent).

  There is a live bug: app/server.mjs line 31 defaults GEMINI_MODEL to "gemini-3.6-flash" when
  the env var is unset, but app/vite.config.ts line 874 (inside createLlmDevPlugin) defaults it
  to "gemini-2.5-flash" instead. Running `npm run dev` without GEMINI_MODEL set in app/.env picks
  up the stale dev-only default and fails with:
  GoogleGenerativeAIFetchError: [404 Not Found] .../v1beta/models/gemini-2.5-flash:generateContent

  Additionally, both files build a hardcoded fallback/retry list inside their callGemini function:
    const candidateModels = Array.from(
      new Set([modelId, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"].filter(Boolean)),
    );
  "gemini-2.0-flash" is a confirmed-retired model (already noted as shut down 2026-06-01 in
  app/.env.example's own comments) and should never be attempted.

  Please:
  1. Change app/vite.config.ts's createLlmDevPlugin default (currently `env.GEMINI_MODEL ||
     "gemini-2.5-flash"`) to `env.GEMINI_MODEL || "gemini-3.6-flash"` so it matches
     app/server.mjs and app/.env.example.
  2. In BOTH app/server.mjs and app/vite.config.ts, edit the candidateModels array (search for
     "candidateModels" — it appears once in each file, inside callGemini) to remove
     "gemini-2.0-flash" and replace the fallback set with other currently-valid, free-tier Flash
     models distinct from the primary default — use ["gemini-3.6-flash", "gemini-3.5-flash",
     "gemini-2.5-flash"] as the fallback trio (keep `modelId` as the first element of the Set, as
     today, so an explicitly-configured GEMINI_MODEL is still tried first).
  3. Read app/.env.example afterward and update its comments only if they now contradict the
     code (e.g. if the fallback list differs from what the comments imply). Do not print or
     modify the real app/.env file, only .env.example.
  4. Do not change app/tests/server/newEndpoints.test.ts — confirm by reading it that it only
     tests schema conversion (openAiSchemaToGemini), not model-name selection, so it needs no
     update for this change.
  5. After editing, run `npm run lint` and `npm test` from the app/ directory and report the
     results. Do not attempt to run `npm run dev` interactively (it's a long-running dev server);
     instead just confirm via reading the edited files that both defaults now match.

  Keep the change minimal and scoped to exactly these two files (plus the .env.example comment
  check) — do not refactor the surrounding callGemini function or touch unrelated code.
  ```

---

### Session 2: Fix retry/timeout amplification against free-tier rate limits

- **Objective:** Prevent a single failing `/_api/generate` (or `/_api/gap-analysis`,
  `/_api/template-extract`) request from burning up to 8 upstream Gemini calls, and fix the
  client-side timeout being shorter than the server's own worst-case retry duration — both of
  which turn one bad model/config into a full free-tier quota exhaustion or a silently-wasted
  late success the UI never sees.
- **Files Affected:**
  - `app/server.mjs`
  - `app/vite.config.ts`
  - `app/src/api/llmClient.ts`
- **Detailed Plan:**
  1. In `callGemini` (both files), reduce the retry fan-out: either (a) cap total attempts across
     all candidate models to a fixed budget (e.g. stop after 3 total attempts regardless of how
     many candidate models remain), or (b) only attempt the `withSchema: false` retry for the
     *first* candidate model, not every candidate — a schema-mode failure on model N is unlikely
     to be fixed by re-trying the same schema failure mode on model N+1's plain-JSON path. Pick
     whichever keeps the function's control flow simplest; document the choice with a short
     comment (both files, kept in sync).
  2. Recompute the worst-case server-side duration after the change and lower
     `GEMINI_CHAT_TIMEOUT_MS`/`GEMINI_STRUCTURED_ATTEMPT_TIMEOUT_MS` and/or raise
     `app/src/api/llmClient.ts`'s `DEFAULT_TIMEOUT_MS` so the client timeout is always **larger**
     than the true server-side worst case, not smaller. Show the arithmetic in a code comment at
     the `DEFAULT_TIMEOUT_MS` declaration so the next person who changes one side remembers to
     check the other (this is the same "keep two numbers in sync" failure mode as Session 1's
     model-default bug, just for timeouts instead of model IDs).
  3. Do not change the deterministic-fallback behavior itself (`buildDeterministic` /
     `generateOne`'s catch block) — only the retry budget and timeout values feeding into it.
  4. Add or update a unit test (likely in `app/tests/server/newEndpoints.test.ts` or a new file
     next to it) that asserts the reduced attempt count — mock `GoogleGenerativeAI` so the test
     doesn't make real network calls, and assert `generateContent` is called at most N times for
     a given failure scenario.
- **Copy-Paste Prompt:**
  ```
  In this repo, app/server.mjs and app/vite.config.ts each contain a duplicated Gemini
  integration (intentional duplication — see docs/NewPersonalPlan.md §2.3; server.mjs is the only
  file copied into the production Docker image). Both files have an identical callGemini function
  with this shape:

    const candidateModels = Array.from(new Set([modelId, ...fallbacks]));
    for (const currentModelId of candidateModels) {
      const attempts = responseFormat
        ? [{ withSchema: true }, { withSchema: false }]
        : [{ withSchema: false }];
      for (const attempt of attempts) {
        // ... one real Gemini generateContent call per attempt ...
      }
    }

  With up to 4 candidate models and 2 attempts each, a single failing /_api/generate call can
  make up to 8 real Gemini API calls. Google's free tier for Flash-family models allows roughly
  10 requests/minute and ~1,500/day (verify current numbers if you have live web access; treat
  these as the right order of magnitude either way) — a handful of failed generations can exhaust
  the whole day's quota through retries alone, and any resulting 429 rate-limit responses will
  look like more of the same generic failure the user already hit.

  Separately: app/src/api/llmClient.ts line 13 sets `DEFAULT_TIMEOUT_MS = 100000` (100 seconds) —
  this is the browser-side abort timeout for /_api/generate. But the server-side worst case is
  computed from GEMINI_STRUCTURED_ATTEMPT_TIMEOUT_MS (default 20000ms) and
  GEMINI_CHAT_TIMEOUT_MS (default 90000ms) applied per attempt across all candidate models/attempts
  — today that's up to (20000+90000) * 4 = 440000ms (~7.3 minutes), which is far longer than the
  client's 100-second patience. The browser gives up and shows an error/fallback well before the
  server would have exhausted its own retry budget, and the abort doesn't cancel the in-flight
  server work, so quota keeps burning for a response nobody will see.

  Please, in both app/server.mjs and app/vite.config.ts (keep them identical, per the
  duplication constraint above):
  1. Reduce the retry fan-out in callGemini so a single request cannot exceed 3 total upstream
     Gemini calls (e.g. try withSchema:true + withSchema:false only for the FIRST candidate
     model, and withSchema:false only for any subsequent fallback models) — choose the simplest
     control-flow change that achieves this cap, and add a short comment explaining the budget.
  2. After that change, recompute the new worst-case total wait time and adjust
     GEMINI_STRUCTURED_ATTEMPT_TIMEOUT_MS / GEMINI_CHAT_TIMEOUT_MS if needed so the total stays
     reasonable (a few minutes, not seven).
  3. In app/src/api/llmClient.ts, update DEFAULT_TIMEOUT_MS so it is always larger than the new
     server-side worst case, and add a one-line comment stating the exact arithmetic (e.g. "must
     exceed N attempts * (structured+chat timeout) from server.mjs/vite.config.ts callGemini").
  4. Add or extend a test under app/tests/server/ that mocks @google/generative-ai's
     GoogleGenerativeAI/getGenerativeModel/generateContent and asserts generateContent is invoked
     at most 3 times when every attempt fails, proving the new cap. Follow the existing test
     file's style/imports.
  5. Run `npm run lint` and `npm test` from app/ and report results.

  Keep this scoped to retry-budget and timeout values only — do not change model names, schema
  conversion logic, or the deterministic-fallback documents themselves.
  ```

---

### Session 3: Migrate off the deprecated `@google/generative-ai` SDK to `@google/genai`

- **Objective:** Replace the archived/legacy `@google/generative-ai` (v0.24.x) dependency with
  Google's current, actively-maintained `@google/genai` unified SDK, since the old package's
  upstream repository has been renamed to `google-gemini/deprecated-generative-ai-js` and Google
  directs all users to migrate. This removes a standing risk of unexplained 404s/behavior drift
  that model-name fixes alone (Session 1) cannot fully rule out (see Audit §1.4).
- **Files Affected:**
  - `app/package.json`
  - `app/server.mjs`
  - `app/vite.config.ts`
  - `app/tests/server/newEndpoints.test.ts` (schema-conversion tests likely need import/type updates)
  - Possibly `app/tests/server/buildGenerateSystemPrompt.test.ts` if it imports anything
    SDK-adjacent (verify before assuming; it may only test prompt-string assembly).
- **Detailed Plan:**
  1. Before making any change, fetch Google's official migration guide
     (`ai.google.dev/gemini-api/docs/migrate`) to get the exact current `@google/genai` API shape
     (client construction, `generateContent` call signature, how `responseSchema` /
     `responseMimeType` / `systemInstruction` / multimodal `inlineData` parts are expressed) —
     do not assume the shape is identical to the old SDK.
  2. In `app/package.json`, replace the `@google/generative-ai` dependency with `@google/genai`
     (pin to the current stable version at implementation time).
  3. In `app/server.mjs`, replace every `GoogleGenerativeAI` import/usage
     (`getGeminiClient`, `genAI.getGenerativeModel(...)`, `model.generateContent(...)`,
     `result.response.text()`, `result.response.candidates?.[0]?.finishReason`) with the
     equivalent `@google/genai` calls. Preserve all surrounding business logic exactly
     (candidate-model loop, schema-vs-no-schema retry, timeout wrapping via `withTimeout`,
     `extractJsonBlock` fallback parsing) — this session changes the transport client only, not
     the retry/prompt logic already addressed in Sessions 1-2.
  4. Apply the identical transformation to `app/vite.config.ts`'s `createLlmDevPlugin` — keep
     both files' Gemini-calling code structurally identical, per the existing duplication
     convention.
  5. Update `openAiSchemaToGemini`/`cleanGeminiSchema` only if the new SDK's `responseSchema`
     shape differs from the old one (check the migration guide) — otherwise leave as-is, since
     schema conversion is independent of which client library sends the request.
  6. Update the PDF-multimodal path (`extractPdfViaMultimodal`, the `inlineData`/`image_url`
     conversion in `convertContentToParts`) to whatever the new SDK expects for inline binary
     data.
  7. Run the existing test suite; update `app/tests/server/newEndpoints.test.ts` only as needed
     to match new import paths/types — do not weaken its assertions.
  8. Manually smoke-test both `npm run dev` (a real generate call) and, if feasible, a production
     build (`npm run build && npm start`) with a real `GEMINI_API_KEY` before considering this
     done — an SDK swap is exactly the kind of change that can pass `npm test` (which likely mocks
     the SDK) while still being broken against the real API.
- **Copy-Paste Prompt:**
  ```
  This repo (app/server.mjs and app/vite.config.ts, both containing a deliberately-duplicated
  Gemini integration — see docs/NewPersonalPlan.md §2.3) currently depends on
  @google/generative-ai (pinned "^0.24.0" in app/package.json, resolved 0.24.1). This package is
  Google's legacy Gemini SDK — its upstream GitHub repo has been renamed
  "google-gemini/deprecated-generative-ai-js" and Google's official guidance is to migrate to the
  new unified @google/genai SDK, which is now GA. This is a suspected contributing factor to
  intermittent 404s on the Generative Language API beyond simple model-name mistakes (the old
  SDK's request plumbing is no longer the officially supported path).

  Your task: migrate the Gemini integration from @google/generative-ai to @google/genai, in both
  app/server.mjs and app/vite.config.ts (createLlmDevPlugin), without changing any business logic
  (prompt tables, DOC_TYPE_GUIDANCE/FORMAT_GUIDANCE/etc., the candidate-model retry loop, timeout
  handling via withTimeout, or extractJsonBlock's fallback JSON parsing) — this is a transport-
  client swap only.

  Steps:
  1. Fetch https://ai.google.dev/gemini-api/docs/migrate (use web access if available) to confirm
     the current @google/genai client construction and generateContent call signature, including
     how responseSchema/responseMimeType, systemInstruction, and inline binary data (for PDF
     multimodal extraction) are expressed in the new SDK. Do not assume it's identical to the old
     SDK's shape.
  2. Update app/package.json: remove @google/generative-ai, add @google/genai at its current
     stable version.
  3. In app/server.mjs, find every use of GoogleGenerativeAI / genAI.getGenerativeModel /
     model.generateContent / result.response.text() / result.response.candidates and replace with
     the equivalent @google/genai calls, preserving the surrounding candidateModels loop,
     attempt-retry structure, and withTimeout wrapping exactly as-is.
  4. Apply the identical change to app/vite.config.ts's createLlmDevPlugin (same functions,
     same duplication convention as server.mjs — keep the two files structurally identical).
  5. Update convertContentToParts / extractPdfViaMultimodal for however @google/genai expresses
     inline PDF/image data (was `inlineData: { mimeType, data }` under the old SDK).
  6. Only touch cleanGeminiSchema/openAiSchemaToGemini if the new SDK's responseSchema field
     names/shape actually differ from the old one — verify from the migration guide before
     changing.
  7. Update app/tests/server/newEndpoints.test.ts if it imports anything from
     @google/generative-ai directly (check first) — update imports/mocks only, keep assertions
     equivalent in strength.
  8. Run `npm run lint`, `npm test`, and `npm run build` from app/ and fix any resulting errors
     before finishing. If a real GEMINI_API_KEY is available in the environment, also start
     `npm run dev` briefly and confirm a real generate call succeeds end-to-end, then stop it.

  Do not change model names/fallback lists (already fixed in a prior session) or retry-count
  budgets (already fixed in a prior session) as part of this task — keep this change scoped to
  the SDK/client library only.
  ```

---

### Session 4: Config/docs consistency hardening (prevent this class of bug recurring)

- **Objective:** Address the smaller consistency gaps found during the audit so the *next* model
  deprecation (which Google ships with as little as ~2 weeks' notice) doesn't reproduce the same
  incident: unify error types between the two duplicated files, add defensive `.trim()`ing of
  env-sourced model/key strings, and add a lightweight startup check that fails loudly (clear log
  line) instead of silently cascading through dead fallbacks.
- **Files Affected:**
  - `app/server.mjs`
  - `app/vite.config.ts`
  - `app/.env.example`
  - `docs/NewPersonalPlan.md` (only if its own model-name examples are now stale — verify first)
- **Detailed Plan:**
  1. In `app/server.mjs`, keep `LlmUnavailableError`; in `app/vite.config.ts`'s
     `createLlmDevPlugin`, define and throw the same named error class instead of a bare `Error`,
     so both files' failure modes are identical (currently `vite.config.ts` throws
     `new Error("LLM_UNAVAILABLE")` while `server.mjs` throws `new LlmUnavailableError(...)`).
  2. Wrap `process.env.GEMINI_MODEL`, `process.env.GEMINI_PDF_MODEL`, and
     `process.env.GEMINI_API_KEY` (and their `env.*` equivalents in `vite.config.ts`) in
     `.trim()` where they're first read, so accidental trailing whitespace/CRLF artifacts from
     `.env` editing can never silently produce a malformed model name or key.
  3. Add a one-time, best-effort startup log (not a hard failure — free-tier/offline use must
     keep working) in both files that states which exact model string will be used as the
     primary default, so a misconfiguration is visible in the terminal immediately at boot rather
     than only surfacing on the first failed generate call.
  4. Re-read `app/.env.example` and `docs/NewPersonalPlan.md`'s Gemini-settings table (§4.2) and
     correct any model-name references that are now stale relative to whatever Session 1 settled
     on, so the documentation and the code cannot drift apart again immediately after this fix.
  5. Do not add a live `models.list()` network call at startup — that would consume quota and
     add latency on every boot for marginal benefit; a config-echo log line is sufficient given
     this is a low-traffic personal-use app per `docs/NewPersonalPlan.md`'s stated purpose.
- **Copy-Paste Prompt:**
  ```
  This repo's Gemini integration is deliberately duplicated across app/server.mjs (production;
  the only file copied into the Docker image) and app/vite.config.ts's createLlmDevPlugin (dev
  server) — see docs/NewPersonalPlan.md §2.3 for why. A prior incident happened because the two
  files' hardcoded GEMINI_MODEL defaults silently diverged, causing a 404 in dev that didn't
  reproduce in prod. That specific bug is already fixed in a prior session; this task is about
  preventing the *next* instance of two-files-drifting-apart from being this hard to diagnose.

  Please make these small, independent hardening changes, applied identically to both
  app/server.mjs and app/vite.config.ts unless noted otherwise:

  1. Error type consistency: app/server.mjs defines and throws `class LlmUnavailableError extends
     Error {}` from getGeminiClient() when GEMINI_API_KEY is missing. app/vite.config.ts's
     getGeminiClient() instead throws a bare `new Error("LLM_UNAVAILABLE")`. Define the same
     LlmUnavailableError class in vite.config.ts's createLlmDevPlugin scope and throw it there
     too, so both files fail identically.

  2. Defensive trimming: wherever GEMINI_MODEL, GEMINI_PDF_MODEL, and GEMINI_API_KEY are first
     read from process.env (server.mjs) or the `env` object (vite.config.ts, inside
     createLlmDevPlugin), wrap the value in .trim() before use, so trailing whitespace/CRLF from
     manual .env edits can never silently produce a bad model name or key. Do not change the
     fallback default strings themselves, just trim whatever was read from the environment first.

  3. Startup visibility: both files already log some startup info (server.mjs has `log("llm",
     ...)` near the bottom; vite.config.ts's createLlmDevPlugin logs in its configureServer
     block). Ensure each one explicitly logs the exact resolved GEMINI_MODEL value (not just
     "Gemini enabled") right at startup, so a wrong default is visible in the terminal
     immediately on `npm run dev` / `npm start`, not only after the first failed generation.
     Do not add any real network call (e.g. no models.list() ping) — this must stay free and
     instant.

  4. Documentation sync: read app/.env.example and docs/NewPersonalPlan.md's "Recommended Gemini
     settings" table (§4.2). If either references a model name that no longer matches what's
     actually hardcoded as the default in app/server.mjs (after any prior fixes), update the doc
     text to match the code — the code is the source of truth here, not the doc.

  5. Run `npm run lint` and `npm test` from app/ and report results.

  Keep every change here small and mechanical — no retry-logic, timeout, or SDK changes (those
  are handled in separate, already-completed sessions).
  ```

---

## 3. Suggested Execution Order

1. **Session 1** — unblocks the reported error immediately; safe, minimal, two files.
2. **Session 2** — hardens against the free-tier quota exhaustion this same failure mode caused
   while broken; independent of Session 3.
3. **Session 3** — larger SDK migration; do this once Sessions 1-2 have restored basic
   functionality, since it's the highest-effort/highest-risk change and benefits from a working
   baseline to diff against.
4. **Session 4** — cleanup/prevention; lowest risk, can be done last or in parallel with Session 3
   review since it touches mostly non-overlapping lines (error classes, logging, env parsing,
   docs) rather than the call logic itself.

Each session's Copy-Paste Prompt above is self-contained: it restates the duplication convention,
the exact files/line areas involved, and the specific finding it addresses, so it can be pasted
into a brand-new Claude Code session with no prior context from this document.
