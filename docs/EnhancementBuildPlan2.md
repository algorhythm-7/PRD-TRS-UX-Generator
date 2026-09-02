# Enhancement Build Plan 2 — Calypso-backed LLM generation (replaces OpenRouter)

## Status

**This document supersedes `docs/EnhancementBuildPlan.md` and `docs/EnhancementToDo.md` entirely.**
Those two documents described an OpenRouter-backed design that is being scrapped per your decision
("Calypso is safe... let's scrap the Open Router integration"). They are **not deleted** (no
destructive action without your explicit confirmation — see §9), but they should be treated as
historical record only; Builder must not implement anything from them going forward. This plan
(`EnhancementBuildPlan2.md`) and its companion `docs/EnhancementToDo2.md` are the only current
sources of truth for the LLM feature from this point on.

**What stays exactly the same as before** (this matters — it's most of the existing, already-
tested code): the frontend orchestration layer built for the OpenRouter design
(`app/src/generation/contract.ts`, `app/src/api/llmClient.ts`,
`app/src/generation/llmGenService.ts`, `app/src/features/input/InputForm.tsx`,
`app/src/features/input/ClarificationQuestions.tsx`, most of `app/src/App.tsx`,
`app/src/generation/sectionSchema.ts`) was deliberately designed **backend-agnostic** — it calls
`/_api/gap-analysis` and `/_api/generate` and doesn't know or care what serves those routes. None
of that code needs to change. Only the **backend implementation** of those two routes (currently
OpenRouter-calling code inside `app/server.mjs` and `app/vite.config.ts`) is being replaced, plus
two new small routes and one new small frontend addition for cold-start handling (§4).

## 1. What Calypso actually is, and what we found (grounded in your attachments — not guessed)

Your own research (`docs/CalpysoWebsites.md`, the live ATLAS dashboard listing) revealed there are
**three different things** all referred to as "Calypso," which is exactly the source of the
confusion you flagged:

1. `docs/XYZCalypso.md` — a **generic** integration guide referencing `application=genllm` and
   `model=mistral:7b`. Per the live ATLAS listing, **`genllm` is currently STOPPED** ("General
   models served by Ollama... 0 instances... STOPPED"). This generic doc's example does not point
   at any of the actually-useful, currently-online models — it's a stale/generic example, not the
   integration we're building against.
2. **`LLM-CALYPSO`** (under "Experiments," 4 CPU, **no GPU allocated at all**) — clicking Access
   returns only `{"status":true}`. There is no documented request/response contract, model ID, or
   example call for this app anywhere in what you gave me. **This is explicitly out of scope for
   this build** — we are not integrating against it, because its contract cannot be determined
   from anything available, and guessing at an undocumented internal API would be irresponsible.
3. **Four real, well-documented, GPU-backed vLLM apps** under the "LLM" section — each with an
   identical, explicit, confirmed contract (state-check, start, OpenAI-compatible chat-completions
   under a per-app path). **These are what this build targets.**

### The confirmed, identical contract shared by every vLLM app (from the individual ATLAS pages you copied)

```
GET  {CALYPSO_BASE_URL}/cmd/state?application={app-name}   -> text body: STOP | STARTING | RUNNING | ONLINE | ERROR
GET  {CALYPSO_BASE_URL}/cmd/start?application={app-name}    -> triggers a start; takes ~4-5 minutes to reach ONLINE
POST {CALYPSO_BASE_URL}/{app-name}/v1/chat/completions      -> OpenAI-compatible chat completions
     body: { "model": "<model-id>", "messages": [...], "max_tokens": N }
```

`CALYPSO_BASE_URL` = `https://apps.services.calypso.intra.chrysler.com` for both local dev and
XYZ-deployed apps (per `docs/XYZCalypso.md`, confirmed identical for both environments). No
API key is required for any of this — access is controlled by network location (VPC-only).

## 2. Model ranking and choices (confirmed with you — not guessed)

| Rank | App name | Model ID (exact string to send) | License | GPUs | Calypso's own use-case tag | Role in this build |
|---|---|---|---|---|---|---|
| 1 (primary) | `vllm-glm-52` | `cyankiwi/GLM-5.2-AWQ-INT4` | MIT (confirmed, "Pure Open") | 8 | "Code generation, Deep reasoning" | **Primary** |
| 2 (fallback) | `vllm-qwen36-35b-a3b` | `Qwen/Qwen3.6-35B-A3B` | Apache-2.0 (Qwen's consistent pattern; not explicitly restated in this doc) | 2 | "Agentic workflows, Coding agents, Multimodal inputs" | **Fallback #1** |
| 3 (fallback) | `vllm-gpt-oss-120b` | `openai/gpt-oss-120b` | Apache-2.0 (confirmed on the HF model card) | 1 | "Light reasoning in agents... Mid speed response time" | **Fallback #2** |

**Explicitly out of scope, per your confirmation and the evidence above:**
- `kvllm-gpt-oss-120b` — an apparent duplicate of `vllm-gpt-oss-120b` (same model, same use-case
  text). You confirmed using `vllm-gpt-oss-120b`; Builder should not also wire the `k`-prefixed
  twin.
- `middlewareai-qwen38-27b`, `middlewareai-ollama`, `middlewareai-mineru` — "Middleware AI"-
  prefixed apps with no use-case tag given for the first, "auxiliary"/OCR framing for the other
  two, suggesting they belong to a different internal team's tooling, not general-purpose
  consumption. Not part of this build.
- `LLM-CALYPSO` (the Experiments-section app) — no usable contract, out of scope per §1.
- Reserved/shared resource note: you confirmed it's organizationally fine to route this app's
  traffic to `vllm-glm-52` (8 GPUs, shared with other teams) routinely. If that ever changes,
  swapping the primary is a one-line config change (§5), not a redesign.

## 3. Rollout: what changes, file by file

### 3.1 `app/server.mjs` (production — same self-contained-file constraint as before)

**Remove entirely:** `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL_CANDIDATES`,
`LLM_REQUEST_TIMEOUT_MS`, `callOpenRouter`, and all OpenRouter-specific request-building logic
inside `handleGapAnalysis`/`handleGenerate`. The `data_collection`/provider-preference logic is
OpenRouter-specific and is removed with it — Calypso has no equivalent concept (it's an internal
service, not a multi-provider router).

**Add:**

- `CALYPSO_BASE_URL` (env override, default `https://apps.services.calypso.intra.chrysler.com`)
- `CALYPSO_MODEL_CANDIDATES` — hardcoded default array of the three `{app, model}` pairs from §2,
  in priority order, with an optional env-var override (`CALYPSO_MODEL_CANDIDATES` as a JSON
  string) for flexibility without a code change if the ranking ever needs to shift.
- `CALYPSO_CHAT_TIMEOUT_MS` (default 90000 — Calypso's own docs recommend 60-120s for chat
  completions, notably longer than OpenRouter's 20s, since these are large internal models without
  the low-latency guarantees of a commercial API).
- `CALYPSO_STATE_TIMEOUT_MS` (default 10000 — state checks should be fast).
- **A scoped TLS-bypass helper, using only Node's built-in `node:https` module — no new npm
  dependency.** Calypso's cert is self-signed (confirmed: docs explicitly say `verify=False`
  in Python examples). The correct, secure way to handle this in Node is **not**
  `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` (that disables certificate validation for
  *every* outbound HTTPS request made by the whole process, including any future integration —
  a real security regression). Instead: build requests with `node:https`'s `request()` API
  directly, passing a dedicated `new https.Agent({ rejectUnauthorized: false })` **only** to
  calls targeting `CALYPSO_BASE_URL`. This keeps the bypass scoped to exactly the one
  internal, self-signed-cert host it's needed for, and requires zero new dependencies —
  preserving the "no Dockerfile change" property the OpenRouter integration had.
  A small `calypsoRequest(path, { method, body, timeoutMs })` helper wraps this (promisified
  `https.request`, JSON body/response handling, timeout via `AbortController` or a manual
  timer + `req.destroy()`).
- `getAppState(appName)` → calls `GET /cmd/state?application={appName}`, returns the trimmed text
  body (`"STOP" | "STARTING" | "RUNNING" | "ONLINE" | "ERROR"`, or `"UNKNOWN"` on any request
  failure — never throws, this is a best-effort check).
- `triggerStart(appName)` → calls `GET /cmd/start?application={appName}`, fire-and-forget (does
  not await the 4-5 minute startup; just confirms the request was accepted).
- `callCalypsoChat(appName, modelId, messages, { responseFormat, maxTokens })` →
  1. `POST {CALYPSO_BASE_URL}/{appName}/v1/chat/completions` with `{ model: modelId, messages,
     max_tokens: maxTokens, response_format: responseFormat }` if `responseFormat` was requested.
  2. If that fails (non-2xx, or the response can't be parsed as the expected JSON shape), **retry
     once** against the same app/model with `response_format` omitted and an extra system-message
     instruction appended ("Respond with ONLY a single valid JSON object, no markdown code fences,
     matching this exact shape: ..."), then defensively extract JSON from the raw text response
     (strip ```json fences if present, regex-match the first balanced `{...}` block, `JSON.parse`
     it).
  3. If both attempts fail, throw — the caller's per-candidate loop catches this and moves to the
     next candidate app.
  4. **This structured-vs-prompt-based fallback must be verified empirically against the real
     Calypso endpoint early in implementation** (§7) — vLLM's OpenAI-compatible server generally
     supports `response_format`/guided decoding, but it is not confirmed whether this specific
     deployment has it enabled. The code must work correctly either way.
- `LlmUnavailableError` — same sentinel-error concept as before, now thrown when every candidate
  in `CALYPSO_MODEL_CANDIDATES` has been tried (or skipped because its state wasn't `ONLINE`) and
  none succeeded.
- **Per-candidate resilience loop** used by both `handleGapAnalysis`/`handleGenerate` (replaces the
  old OpenRouter model-candidate loop, same shape): for each `{app, model}` in
  `CALYPSO_MODEL_CANDIDATES`, in order:
  1. `state = await getAppState(app)`.
  2. If `state === "ONLINE"`: attempt `callCalypsoChat(...)`. Success → return the result
     immediately (do not try further candidates). Failure → log and continue to the next
     candidate.
  3. If `state === "STOP"`: call `triggerStart(app)` (fire-and-forget, primes it for a future
     request) and continue to the next candidate — **never block the current request waiting for
     a 4-5 minute cold start.**
  4. If `state === "STARTING"` or `"ERROR"` or `"UNKNOWN"`: skip this candidate (don't re-trigger
     start if already starting), continue to the next candidate.
  5. If every candidate was skipped/failed: throw `LlmUnavailableError` → handler catches → `503
     { error: "LLM_UNAVAILABLE" }` → frontend's existing fallback cascade takes over exactly as it
     does today (this part of the design is unchanged and already proven).

**New routes** (in addition to the existing, unchanged `/_api/gap-analysis` and
`/_api/generate`):

- `GET /_api/llm-status` → checks `getAppState("vllm-glm-52")` (the primary only, to keep this
  fast) and returns `200 { "ready": boolean, "primary": { "app": "vllm-glm-52", "state": "<state>" } }`,
  where `ready = state === "ONLINE"`.
- `POST /_api/llm-warmup` → calls `triggerStart("vllm-glm-52")` (primary only — not all three
  candidates; starting 11 GPUs' worth of models "just in case" on every page load would be
  wasteful and inconsiderate of a shared resource) and returns `202 { "triggered": true }`
  immediately, without waiting.

**Startup log block**: replace the OpenRouter-specific log lines with equivalent Calypso ones
(e.g. `[llm] Calypso enabled - primary: vllm-glm-52, 2 fallback candidate(s) configured`).

### 3.2 `app/vite.config.ts` (dev — same duplication pattern as before, same justification)

`createLlmDevPlugin` gets the identical Calypso logic duplicated (not imported from `server.mjs`,
for the same two reasons already documented in the original plan: `server.mjs` must stay a single
self-contained file per the Dockerfile's `COPY --from=src server.mjs .` constraint, and importing
`server.mjs` here would trigger its unconditional `app.listen()`). Add the same
`/_api/llm-status` and `/_api/llm-warmup` handling to the dev plugin's middleware.

### 3.3 Frontend — small, additive changes only

- **`app/src/api/llmClient.ts`**: add `getLlmStatus(): Promise<{ready: boolean; primary: {app:
  string; state: string}}>` (GET `/_api/llm-status`) and `triggerLlmWarmup(): Promise<void>` (POST
  `/_api/llm-warmup`, fire-and-forget from the caller's perspective — resolve on any response,
  don't throw on failure since this is a best-effort background nicety). Same
  `AbortController`-timeout pattern as the two existing functions, shorter timeout (~5s) since
  these are supposed to be fast/non-blocking calls.
- **`app/src/App.tsx`**: add a `useEffect` on mount that (a) calls `triggerLlmWarmup()` once,
  fire-and-forget, and (b) calls `getLlmStatus()` immediately and then on an interval (~20s),
  storing `{ready, state}` in a small piece of state. While `!ready`, render a small non-blocking
  notice reusing the existing `.alert.alert--info` class: *"The AI model is warming up (first use
  after a period of inactivity can take a few minutes) — document generation will use the offline
  fallback until it's ready."* This never blocks the existing Generate button or flow — a user can
  click Generate immediately regardless of this banner; worst case they get the (already
  perfectly functional) deterministic fallback while Calypso finishes starting up for next time.
  Stop polling once `ready` becomes `true` (no need to keep checking after that).
- **Everything else frontend-side is unchanged**: `contract.ts`, `sectionSchema.ts`,
  `llmGenService.ts`, `InputForm.tsx`, `ClarificationQuestions.tsx`, the rest of `App.tsx`
  (gap-analysis → clarifications → generation flow, the `source: "llm" | "fallback"` fallback
  notice) all continue to work exactly as already built and tested — they only ever talk to
  `/_api/gap-analysis` and `/_api/generate`, which keep the same request/response contract.

## 4. Secrets and environment variables — simpler than before, likely zero required

**No API key is needed at all** — Calypso access is controlled purely by network location (the
XYZ pod already lives inside the same VPC, per `docs/XYZCalypso.md`). This eliminates the
`OPENROUTER_API_KEY` secret requirement entirely; **there is nothing to add to this app's XYZ
Secrets for this feature**, unless you want to override a default via the optional env vars below
(none are required for correct operation):

| Variable | Required? | Default |
|---|---|---|
| `CALYPSO_BASE_URL` | No | `https://apps.services.calypso.intra.chrysler.com` |
| `CALYPSO_MODEL_CANDIDATES` | No | the three-entry list in §2, as JSON |
| `CALYPSO_CHAT_TIMEOUT_MS` | No | `90000` |
| `CALYPSO_STATE_TIMEOUT_MS` | No | `10000` |

## 5. Testing strategy

- **Existing tests are unaffected and must stay green**: since `llmClient.ts`'s
  `postGapAnalysis`/`postGenerate` signatures don't change, none of the existing mocked tests
  (`llmGenService.test.ts`, `app.test.tsx`, `e2e/acceptance.test.tsx`, `inputForm.test.tsx`, etc.)
  need any changes.
- **New/updated tests needed**:
  - `app.test.tsx` (or a new test file): mock `getLlmStatus`/`triggerLlmWarmup` from
    `api/llmClient.ts`; verify the warm-up banner renders when `ready: false` and disappears once
    a subsequent poll returns `ready: true`; verify Generate still works immediately regardless of
    banner state.
  - A new small unit-style test (or documented manual-verification step, matching the precedent
    set for `server.mjs` itself, which has no dedicated unit tests today — only `tsc -b`, `node
    --check`, and live manual verification) for the candidate-loop logic: state `STOP` triggers a
    start and skips to next candidate without blocking; state `ONLINE` attempts the chat call;
    all-candidates-exhausted throws `LlmUnavailableError`.
- **Live manual verification, required before calling this done** (mirrors the rigor already
  applied to the OpenRouter integration): from a machine with access to
  `apps.services.calypso.intra.chrysler.com` (confirmed reachable identically from local dev and
  XYZ-deployed per the docs), verify:
  1. `GET /_api/llm-status` reflects the real state of `vllm-glm-52`.
  2. `POST /_api/llm-warmup` actually starts it if stopped (check the ATLAS dashboard yourself to
     confirm state transitions to STARTING → ONLINE).
  3. A real `Generate` click, once `vllm-glm-52` is ONLINE, returns LLM-authored content tagged
     `source: "llm"` — not the fallback.
  4. Stopping/being unable to reach the primary candidate correctly falls through to
     `vllm-qwen36-35b-a3b`, then `vllm-gpt-oss-120b`, then finally the deterministic generator,
     with the correct fallback notice at each stage.
  5. **Specifically confirm whether `response_format`/structured JSON output is honored** by at
     least the primary model — this determines whether the prompt-based-JSON fallback path in
     `callCalypsoChat` is a rarely-used safety net or the primary code path in practice. Either
     way the code must work; this verification just tells us which path to expect in production.

## 6. Risks and honest open items

- **Structured output support: CONFIRMED via live testing** — `response_format`/structured JSON
  output is reliably honored by `vllm-glm-52`; repeated gap-analysis and generate calls succeeded
  on the first (schema-constrained) attempt. The prompt-based fallback path remains in place as a
  safety net and was exercised once during testing (see below), but is not the common case.
- **Two real bugs found and fixed during live verification** (not present in this plan's original
  design, discovered only once real end-to-end calls were made):
  1. `generateSchema`'s JSON schema puts section names at the top level, but the frontend's
     `GenerateResponse` type expects `{ sections: {...} }` — every real generate call was silently
     falling back (`Cannot read properties of undefined` in `buildGeneratedDocument`), even though
     Calypso's response was perfectly valid. This bug pre-dates Calypso (same shape existed in the
     original OpenRouter design) and was never caught before because OpenRouter was never
     live-tested with a real key. Fixed by wrapping the response as `{ sections: result }` before
     sending it, in both `server.mjs` and `vite.config.ts`.
  2. The client-side `DEFAULT_TIMEOUT_MS` in `app/src/api/llmClient.ts` was still 20000 (inherited
     from the OpenRouter design) — shorter than the backend's own 90000ms Calypso timeout, and
     shorter than Calypso's real observed response times (12-37s). Bumped to 100000 so the client
     never discards a response the backend was still willing to wait for.
  3. Also found: the prompt-based fallback path (used when `response_format` fails) was dumping
     the *entire* `response_format` wrapper into the instruction text, causing the model to echo
     the schema back verbatim instead of returning matching data on that path. Fixed by extracting
     just `responseFormat.json_schema.schema` and clarifying the wording.
  4. Also found: a single shared `max_tokens: 4096` default was an unnecessary regression vs.
     OpenRouter's old "no explicit cap" behavior for the generate call (a 9-section PRD can
     legitimately need more). Split into `CALYPSO_GAP_ANALYSIS_MAX_TOKENS` (1024) and
     `CALYPSO_GENERATE_MAX_TOKENS` (8192).
  5. Also found, via a safe controlled test (temporary `CALYPSO_MODEL_CANDIDATES` env-var
     override with fake app names - no real Calypso app was ever touched/disabled): the
     prompt-based-fallback instruction was appended as a second `role: "system"` message, which
     `vllm-qwen36-35b-a3b` rejected with `400 "System message must be at the beginning"`. Fixed
     by using `role: "user"` instead. The same controlled test confirmed the full 3-level
     candidate cascade works correctly (skip-on-bad-state, skip-on-failure, and total-failure →
     `503 LLM_UNAVAILABLE` → deterministic fallback).
- **Shared GPU resource**: `vllm-glm-52` runs on 8 GPUs shared with other internal teams/workloads
  — you've confirmed this is fine, but if response times degrade under contention, that's a
  platform-level capacity question, not a bug in this app.
- **Cold-start UX**: the warm-up banner design (§3.3) means a user's very first visit after a
  period of no one using GLM-5.2 may see a "warming up" notice and get fallback-generated content
  for a few minutes until the model comes online — this is expected, not a defect, and is
  explicitly the tradeoff you chose (proactive warmup + non-blocking banner) over a blocking
  spinner.
- **Self-signed certificate handling**: scoped to `node:https` + a dedicated `Agent` for Calypso
  calls only, never a process-wide TLS bypass — Builder must not take the shortcut of setting
  `NODE_TLS_REJECT_UNAUTHORIZED=0` globally, even though it would "work," because it silently
  disables certificate validation for every other outbound request the process ever makes.
- **Network reachability from the actual implementation/test environment** is assumed based on
  the docs ("Local development... same base URL") but has not been physically verified in this
  planning session (no tool available here can reach an internal-only `intra.chrysler.com` host).
  Builder must confirm this works from their real dev machine/XYZ deployment as the first
  practical step, before writing extensive code around it.

## 7. Explicit non-goals

- No changes to `docker/`, `deployment/`, `docker-bake.hcl`, or `app/package.json` — this
  integration uses only Node built-ins (`node:https`), so no new dependency and no Dockerfile
  change is needed, exactly matching the property the original OpenRouter design had.
- No integration with `LLM-CALYPSO`, `middlewareai-*` apps, or `kvllm-gpt-oss-120b` — all
  explicitly out of scope per §2.
- No blocking/spinner-based wait for cold starts — the non-blocking warm-up banner (§3.3) is the
  only UX affordance for this; Generate always works immediately (falling back if needed).
- Deleting/rewriting `docs/EnhancementBuildPlan.md`/`docs/EnhancementToDo.md` is **not** part of
  this plan — see `docs/EnhancementToDo2.md` task list for the (non-destructive) recommended
  treatment of those files.
