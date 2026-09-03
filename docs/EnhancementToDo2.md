# Enhancement To-Do 2 — Builder Tracking (Cluster integration, replaces OpenRouter)

Tracks execution of `docs/EnhancementBuildPlan2.md`. **This supersedes `docs/EnhancementToDo.md`**
(the OpenRouter task list) — do not resume work from that file. "Done" means implemented **and**
validated (lint/tsc/build/test as applicable), not just written.

## 0. Before writing any code

- [x] 0a. Confirmed reachable from this dev environment (VPN/corporate network already active).
- [x] 0b. `curl -k .../cmd/state?application=vllm-glm-52` returned a real state (`"ONLINE"` -
      note: JSON-quoted string, not bare text - `getAppState` handles both forms).

## 1. Remove the OpenRouter implementation from the two backend files

- [x] 1. Removed from `app/server.mjs`.
- [x] 2. Removed from `app/vite.config.ts`.
- [x] 3. Validated clean.

## 2. Implement the Cluster client helpers in `app/server.mjs`

- [x] 4. Added, plus a split `Cluster_GAP_ANALYSIS_MAX_TOKENS` (1024) / `Cluster_GENERATE_MAX_TOKENS`
      (8192) rather than one shared value - found via live testing that a single 4096 default was
      an unnecessary regression vs. OpenRouter's old "no explicit cap" behavior.
- [x] 5. Implemented with `node:https` + scoped `Agent({ rejectUnauthorized: false })`. No new
      dependency added.
- [x] 6. Implemented. Note: `/cmd/state` returns a JSON-quoted string, not bare text - handled.
- [x] 7. Implemented as designed.
- [x] 8. Implemented as designed.
- [x] 9. Wired. **Bug found and fixed during live verification**: `generateSchema`'s JSON schema
      puts section names at the top level, but the frontend's `GenerateResponse` type expects
      `{ sections: {...} }` - every real generate call was silently failing at
      `buildGeneratedDocument` (`Cannot read properties of undefined`) and falling back, even
      though Cluster's response was perfectly valid. This bug pre-dates Cluster entirely (same
      shape existed in the original OpenRouter code) and was never caught before because
      OpenRouter was never live-tested with a real key. Fixed by wrapping the response as
      `res.json({ sections: result })`.
- [x] 10. Implemented as designed.
- [x] 11. Implemented as designed.
- [x] 12. Duplicated into `app/vite.config.ts`, including the fix above.
- [x] 13. Validated clean.

## 3. Frontend additions (small, additive — most existing frontend code is untouched)

- [x] 14. Added. **Also bumped `DEFAULT_TIMEOUT_MS` from 20000 to 100000** in the same file -
       found via live testing that Cluster's real response times (12-37s observed) could
       legitimately exceed the old 20s client-side abort, discarding perfectly good responses.
       Must stay above `Cluster_CHAT_TIMEOUT_MS` (90000).
- [x] 15. Implemented as designed.
- [x] 16. Confirmed - no other frontend file needed changes.
- [x] 17. Validated clean.

## 4. Tests

- [x] 18. Confirmed - all pre-existing tests pass unmodified. **Found and fixed a real test-suite
       flakiness issue**: the new warm-up `useEffect` makes real, unmocked background fetch calls
       on every `<App />` mount, which raced unpredictably against `e2e/acceptance.test.tsx`
       (intermittent failure, reproduced then fixed). Fixed by adding a global partial mock for
       just `getLlmStatus`/`triggerLlmWarmup` in `tests/setup.ts` (keeping `postGapAnalysis`/
       `postGenerate` real, preserving every existing test's intended behavior). Confirmed stable
       across 3+ consecutive full-suite runs after the fix.
- [x] 19. Added `tests/appLlmStatus.test.tsx` (3 tests): banner shows immediately when not ready,
       hides once ready, and Generate still works regardless of banner state.
- [x] 20. Full gate green: lint, `tsc -b`, `npm run build`, 19 files / 43 tests.

## 5. Live manual verification (required — do not skip)

- [x] 21. Confirmed - `GET /_api/llm-status` correctly reflected `vllm-glm-52`'s real live state
       (`ONLINE`), cross-checked against direct `curl` calls to Cluster.
- [x] 22. Confirmed - `POST /_api/llm-warmup` successfully triggers `/cmd/start`.
- [x] 23. Confirmed via full browser UI walkthrough (Fleet Tracker / UX doc type): real,
       detailed, LLM-authored content rendered with no fallback notice, after fixing the
       sections-wrapping bug (see task 9 above). Also confirmed for PRD and via direct
       `Invoke-RestMethod` calls (9-section PRD, genuinely high-quality, specific content).
- [x] 24. **Confirmed: `response_format`/structured JSON output IS reliably honored** by
       `vllm-glm-52` - repeated gap-analysis and generate calls succeeded on the first
       (schema-constrained) attempt with no parse errors. One early transient failure did occur
       (a malformed/truncated response caused a fallback to the prompt-based path), which also
       exposed a real prompt-wording bug: the fallback instruction was dumping the full
       `response_format` wrapper (not just the inner JSON Schema) into the prompt, causing the
       model to echo the schema back verbatim instead of producing matching data on that path.
       Fixed by extracting `responseFormat.json_schema.schema` and clarifying the instruction
       wording ("this is a schema, not the output - do not return the schema itself").
- [x] 25. **Safely tested via `Cluster_MODEL_CANDIDATES` env-var override** (no code changes, no
       real Cluster app touched/disabled - fake app names always return `state=UNKNOWN` and are
       skipped harmlessly): confirmed the full 3-level cascade works - (a) fake primary → skipped
       → real `vllm-qwen36-35b-a3b` → real `vllm-gpt-oss-120b` succeeds; (b) all three candidates
       fake → correct `503 { error: "LLM_UNAVAILABLE" }`. **Found and fixed one more real bug**:
       the prompt-based-fallback instruction was appended as a second `role: "system"` message,
       which `vllm-qwen36-35b-a3b` rejected with `400 "System message must be at the beginning"`.
       Fixed by using `role: "user"` instead (any backend accepts a trailing user-role
       instruction). Re-tested after the fix: the 400 error is gone. Full gate re-confirmed green
       (19 files / 43 tests) after this fix.

## 6. Documentation housekeeping (non-destructive — do not delete anything)

- [ ] 26. Add a one-line "Superseded by `docs/EnhancementBuildPlan2.md`" banner at the very top of
       `docs/EnhancementBuildPlan.md` and `docs/EnhancementToDo.md`. Do **not** delete or rewrite
       their content — they remain as historical record of the OpenRouter design that was
       scrapped. (If you believe these should actually be deleted, ask first — that's a
       destructive action outside what was explicitly requested.)
- [ ] 27. Confirm `git status`/`git diff --stat` shows changes only to `app/server.mjs`,
       `app/vite.config.ts`, `app/src/api/llmClient.ts`, `app/src/App.tsx`, test files, and docs —
       no unexpected changes to `docker/`, `deployment/`, `docker-bake.hcl`, or
       `app/package.json`/`app/package-lock.json` (this integration should need zero new
       dependencies).

## Commit checkpoints

Tell the user explicitly when a checkpoint is validated and a commit makes sense — not before,
same convention as the rest of this project.
