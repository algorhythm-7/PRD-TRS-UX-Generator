# SpecPilot — Personal Gemini Migration Plan

> **Purpose:** Replace the internal **Cluster** LLM cluster (reachable only inside the old XYZ corporate network) with **Google Gemini** using a free personal API key, while keeping all existing SpecPilot features working.
>
> **Status:** Planning only — implementation has **not** started. This document is written so a future implementation pass can follow it step-by-step without re-discovering the codebase.
>
> **Audience:** You (the repo owner) and any agent/developer doing the migration work.

---

## 1. Executive summary

**SpecPilot** is a React + TypeScript web app that generates **PRD**, **TRS**, and **UX** documents from a product description. It already has:

- A rich **Generation Profile** UI (formats, depth, traceability, reference uploads, etc.)
- **Clarifying questions** before generation (gap analysis)
- **Human-in-the-loop regeneration** with edits and section feedback
- **Word / PDF / HTML export**
- A **deterministic offline fallback** when the LLM path fails

The LLM integration lives **entirely on the server side** (never in the browser). The React UI only calls same-origin `/_api/*` routes. Today those routes talk to **Cluster** — an internal vLLM deployment that:

- Has **no API key** (network/VPC access only)
- Requires **model warm-up** (`/cmd/start`, 4–5 minute cold starts)
- Races multiple model candidates with state polling
- Uses a self-signed TLS certificate

Because you no longer have XYZ / Cluster access, **every LLM call fails** → users only see the basic offline fallback (which ignores most Generation Profile settings).

**The fix:** Swap the Cluster client for the **Gemini Generative Language API**, keyed by `GEMINI_API_KEY` in a local `.env` file. Keep the same `/_api/*` contract so the React app, export flow, and session memory need **no functional redesign**.

---

## 2. How the app worked before (verified from code)

### 2.1 Stack

| Layer | Technology | Location |
|-------|------------|----------|
| UI | React 19, Mantine, Vite 7 | `app/src/` |
| Dev server | Vite + custom `llm-dev` plugin | `app/vite.config.ts` |
| Production server | Express (`server.mjs`) + static `dist/` | `app/server.mjs` |
| Tests | Vitest | `app/tests/` |

This is a **Node.js / TypeScript** project — not Python. Dependencies are managed with **npm** (like `pip` + `venv`, but `node_modules` is auto-used; no activate step).

### 2.2 Request flow (unchanged after migration)

```
Browser (React)
  → fetch("/_api/gap-analysis" | "/_api/generate" | ...)
    → Dev:  Vite middleware in vite.config.ts (llm-dev plugin)
    → Prod: Express handlers in server.mjs
      → [TODAY: callCluster]  →  [TARGET: callGemini]
        → JSON response → buildGeneratedDocument → OutputView
```

If the LLM call throws → `llmGenService.generateOne` catches and uses `prdGen.ts` / `trsGen.ts` / `uxGen.ts` (offline fallback).

### 2.2 Endpoints that use the LLM

| Route | Purpose | Fallback if LLM down? |
|-------|---------|----------------------|
| `POST /_api/gap-analysis` | Up to 5 clarifying questions | Yes — returns `[]` (silent skip) |
| `POST /_api/generate` | Full document sections (JSON) | Yes — deterministic generator per doc type |
| `POST /_api/template-extract` | Section names from custom template | **No** — shows upload error |
| `POST /_api/context-extract` (PDF path) | Extract text from PDF | **No** — shows upload error |
| `POST /_api/context-extract` (text path) | Truncate to char limit | N/A — no LLM |
| `GET /_api/llm-status` | “AI warming up” banner | N/A |
| `POST /_api/llm-warmup` | Fire-and-forget model start | N/A |

### 2.3 Critical maintenance constraint

**The entire LLM + prompt pipeline is duplicated in two files:**

1. `app/server.mjs` — production (Docker copies **only** this file + `dist/`, so it cannot `import` from elsewhere)
2. `app/vite.config.ts` — development (`createLlmDevPlugin`)

Every Cluster → Gemini change must be applied to **both**, or dev and prod will diverge silently. See `docs/DeveloperDocs.md` §2.2 and §17.

### 2.4 What does *not* need to change

- `app/src/**` — React UI, generation orchestration, export, session memory
- `app/src/api/llmClient.ts` — still calls `/_api/*` (only timeout comments may be updated)
- Prompt tables (`DOC_TYPE_GUIDANCE`, `FORMAT_GUIDANCE`, `buildGenerateSystemPrompt`, etc.) — **reuse as-is**; only the transport layer changes
- Deterministic fallback generators — keep as safety net
- `localStorage` session history — unchanged

### 2.5 XYZ / corporate leftovers (optional cleanup, not blocking)

These are inert for personal Gemini use but confusing:

- OAuth proxy (`OAUTH_*`, `BACKEND_URL`) in `server.mjs` / `vite.config.ts`
- `@Orggadp/XYZ-sdk` in `package.json` devDependencies (not imported in `src/`)
- `app/.npmrc.example` — GitHub Packages auth for XYZ private npm
- `VITE_XYZ_*` in `app/.env.example`

Safe to remove in a later cleanup pass; **not required** for Gemini to work.

---

## 3. Why it is broken today

| Symptom | Root cause |
|---------|------------|
| Banner: “AI model is warming up…” never clears (or clears but generation still fails) | `/_api/llm-status` polls Cluster `/cmd/state` on an unreachable host |
| All documents show “Generated using the offline fallback” | `callCluster` throws `LlmUnavailableError` — no ONLINE candidates |
| Custom template upload fails | `/_api/template-extract` returns `503 LLM_UNAVAILABLE` |
| PDF reference upload may fail | Multimodal Cluster call unreachable |

The app **still runs** — `npm run dev` serves the UI — but AI features are dead without a reachable LLM.

---

## 4. Target architecture (Gemini)

### 4.1 Design principles

1. **API key stays server-side only** — never in React, never `VITE_*`, never committed to git.
2. **Keep the `/_api/*` contract** — minimize frontend churn.
3. **Replace transport, not product logic** — same prompts, schemas, temperature mapping.
4. **Simplify status/warmup** — Gemini has no cold-start model fleet; status = “key configured + quick health ping”.
5. **Keep offline fallback** — still valuable if quota exceeded or network fails.

### 4.2 Recommended Gemini settings

| Setting | Recommended value | Notes |
|---------|-------------------|-------|
| `GEMINI_API_KEY` | From [Google AI Studio](https://aistudio.google.com/apikey) | Free tier; rate limits apply |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Fast, cheap, good JSON behavior; free tier available (use `gemini-3.5-flash-lite` for lighter/cheaper option) |
| `GEMINI_PDF_MODEL` | Same as `GEMINI_MODEL` or `gemini-3.5-flash` | For PDF multimodal extraction |
| Timeouts | 90s chat / 20s structured | Per retry budget in callGemini; 1 structured + 2 chat = max ~200s total per request |

### 4.3 API mapping: Cluster → Gemini

| Cluster concept | Gemini replacement |
|-----------------|-------------------|
| `callCluster(messages, responseFormat, maxTokens, temperature)` | `callGemini(...)` using `@google/generative-ai` SDK or REST `generateContent` |
| OpenAI-style `response_format: { type: "json_schema", ... }` | `generationConfig.responseMimeType: "application/json"` + `responseSchema` (convert from existing JSON Schema objects) |
| System + user messages | Gemini `systemInstruction` + `contents` (or prepend system text to first user turn if using older API shape) |
| Structured attempt + plain-JSON retry | **Keep the same pattern** — Gemini JSON mode can still fail on large section lists; retry with schema-in-prompt |
| `getAppState` / `triggerStart` / candidate racing | **Remove** — single model, no fleet |
| `/_api/llm-status` → `{ ready, primary: { app, state } }` | `{ ready: !!GEMINI_API_KEY, primary: { app: "gemini", state: "ONLINE" \| "MISCONFIGURED" } }` — keep shape for frontend compatibility |
| `/_api/llm-warmup` | No-op `202 { triggered: false }` or optional tiny `generateContent("ping")` |
| PDF as `image_url` data URL | Gemini `inlineData` with `mimeType: "application/pdf"` (native support in 1.5+ / 2.0) |
| `rejectUnauthorized: false` HTTPS agent | **Delete** — Google APIs use valid public TLS |

### 4.4 JSON schema conversion helper

Existing functions already produce OpenAI-style schemas:

- `gapAnalysisSchema()`
- `generateSchema(sections)`
- `templateExtractSchema()`
- `pdfExtractSchema()`

Add a small converter `openAiJsonSchemaToGemini(schema)` that unwraps `json_schema.schema` for Gemini’s `responseSchema` field. Use in `callGemini` when `responseFormat` is provided.

### 4.5 Error handling (preserve behavior)

| Failure | Server response | Client behavior |
|---------|-----------------|-----------------|
| Missing/invalid API key | `503 { error: "LLM_UNAVAILABLE" }` + log `[gemini] ...` | Same as today |
| Quota / 429 | Same | Fallback or upload error |
| Malformed JSON from model | Retry with plain-JSON prompt (existing pattern) | Same |
| Timeout | Same | Fallback |

---

## 5. API key setup (for the repo owner)

### 5.1 Get a key

1. Open [Google AI Studio → API keys](https://aistudio.google.com/apikey).
2. Create an API key (free tier is fine for personal use).
3. Copy the key once — treat it like a password.

### 5.2 Where to put it (development)

Create **`app/.env`** (this file is **gitignored**):

```env
# Server-side only — loaded by vite.config.ts via loadEnv()
GEMINI_API_KEY=AIza...your-actual-key...

# Optional overrides
GEMINI_MODEL=gemini-2.0-flash
```

**Do not:**

- Put the key in `app/src/**` or any React file
- Prefix with `VITE_` (that would bundle it into the browser)
- Commit `app/.env` to git

### 5.3 How it gets loaded (Node vs Python mental model)

| Python habit | This project |
|--------------|--------------|
| `.env` + `python-dotenv` | Vite `loadEnv(mode, process.cwd(), "")` in `vite.config.ts` — reads `app/.env` when you run `npm run dev` from `app/` |
| `os.environ["KEY"]` | `process.env.GEMINI_API_KEY` or `env.GEMINI_API_KEY` from `loadEnv` in the Vite plugin |
| `export KEY=...` in shell | Also works: `$env:GEMINI_API_KEY="..."` in PowerShell before `npm run dev` |

For **production** (`node server.mjs`), Node does **not** auto-load `.env`. Options:

- **A (recommended for personal use):** Use `dotenv` at top of `server.mjs`: `import "dotenv/config"` and add `dotenv` to dependencies
- **B:** Set `GEMINI_API_KEY` in the shell / Docker `-e` / hosting dashboard

### 5.4 Update `app/.env.example` (committed template)

Replace Cluster/OAuth placeholders with:

```env
# Server-side only — copy to .env and fill in your key
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.0-flash

# Optional — only if you still use a separate backend via the XYZ proxy pattern
# BACKEND_URL=http://localhost:5000
```

---

## 6. Keeping the API key out of GitHub

### 6.1 Already protected

Root `.gitignore` contains:

```
.env*
!.env.example
```

So `app/.env`, `.env.local`, etc. are **not** tracked. Only `.env.example` (placeholders) should be committed.

### 6.2 Before every push — habit checklist

```powershell
cd c:\Users\vincy\Downloads\prd-generator-main\prd-generator-main
git status
```

Confirm **no** `.env` file appears. If it does:

```powershell
git restore --staged app/.env   # if accidentally staged
```

### 6.3 If the key was ever committed

1. **Rotate the key immediately** in Google AI Studio (revoke old, create new).
2. Remove from git history (e.g. `git filter-repo` or GitHub secret scanning guidance).
3. Never rely on “I’ll delete it in the next commit” — history retains it.

### 6.4 Optional extra safety

- Add a **pre-commit** hook or CI grep that fails if `AIza` appears in tracked files.
- Use GitHub **secret scanning** (on by default for public repos).

---

## 7. Implementation plan (step-by-step for the builder agent)

### Phase 0 — Prerequisites (you, before coding)

- [ ] Create `app/.env` with `GEMINI_API_KEY`
- [ ] Confirm Node 20+: `node --version`
- [ ] From `app/`: `npm install`

> **Note:** `@Orggadp/XYZ-sdk` may fail `npm install` if you don’t have GitHub Packages auth. For personal use, **remove** that devDependency (and optionally delete `app/.npmrc` if present) before install — it is unused in `src/`.

### Phase 1 — Add Gemini dependency

In `app/package.json`:

```json
"@google/generative-ai": "^0.24.0"
```

Optional for production `.env` loading:

```json
"dotenv": "^16.4.0"
```

Run `npm install` in `app/`.

### Phase 2 — Implement `callGemini` in `server.mjs`

**File:** `app/server.mjs`

1. **Remove** (or gate behind `USE_Cluster=false` during transition):
   - `Cluster_BASE_URL`, `Cluster_MODEL_CANDIDATES`, `ClusterAgent`, `ClusterRequest`
   - `getAppState`, `triggerStart`, `callClusterChat`, `callCluster`
   - All `Cluster_*_TIMEOUT` and state-race logic

2. **Add:**
   ```javascript
   import { GoogleGenerativeAI } from "@google/generative-ai";
   // At top, if using dotenv: import "dotenv/config";

   const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
   const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

   function getGeminiClient() {
     if (!GEMINI_API_KEY) throw new LlmUnavailableError("GEMINI_API_KEY not set");
     return new GoogleGenerativeAI(GEMINI_API_KEY);
   }
   ```

3. **Implement `callGemini(messages, responseFormat, maxTokens, temperature)`:**
   - Map `messages` → `systemInstruction` + user content string(s)
   - For multimodal PDF messages (array content blocks), map to `inlineData` parts
   - Call `model.generateContent({ contents, generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType, responseSchema } })`
   - Parse `response.text()` → `JSON.parse` → `extractJsonBlock` fallback (reuse existing helper)

4. **Replace** every `callCluster(...)` with `callGemini(...)`.

5. **Update `handleLlmStatus`:**
   ```javascript
   async function handleLlmStatus(_req, res) {
     const configured = Boolean(GEMINI_API_KEY);
     res.json({
       ready: configured,
       primary: { app: "gemini", state: configured ? "ONLINE" : "MISCONFIGURED" },
     });
   }
   ```

6. **Update `handleLlmWarmup`:** return `202 { triggered: false }` (or optional ping).

7. **Update startup logs:** replace Cluster banner with Gemini model name; warn if `GEMINI_API_KEY` missing.

8. **Add production dependencies** to `package.json` (currently missing!):
   ```json
   "express": "^4.21.0",
   "http-proxy-middleware": "^3.0.0"
   ```
   `server.mjs` imports these but they are not listed today — production `node server.mjs` would fail without them.

### Phase 3 — Mirror changes in `vite.config.ts`

**File:** `app/vite.config.ts`

Inside `createLlmDevPlugin(env)`:

1. Read `env.GEMINI_API_KEY`, `env.GEMINI_MODEL` (from `loadEnv` — same keys as `.env`).
2. Duplicate the **same** `callGemini` / schema conversion / handlers as `server.mjs`.
3. Update middleware logging from `[llm-dev] Cluster enabled` to `[llm-dev] Gemini enabled`.
4. Keep exported test helpers (`buildGenerateSystemPrompt`, `templateExtractSchema`, `applyContextExtractBudget`) — tests depend on them.

> **Sync discipline:** After editing, diff the LLM-related sections of both files or add a comment block: `// SYNC: server.mjs LLM section`.

### Phase 4 — Frontend tweaks (minimal)

| File | Change |
|------|--------|
| `app/src/api/llmClient.ts` | Update timeout comment (Cluster → Gemini); optionally reduce `DEFAULT_TIMEOUT_MS` to `100000` |
| `app/src/App.tsx` | Optional: soften warm-up banner text (“Checking AI service…” vs “warming up”) — **not required** if status returns `ready: true` when key is set |

No changes required to `llmGenService.ts`, `GenerationProfileScreen.tsx`, etc.

### Phase 5 — Configuration files

| File | Action |
|------|--------|
| `app/.env.example` | Document `GEMINI_API_KEY`, `GEMINI_MODEL`; remove or comment OAuth/Cluster vars |
| `AGENTS.md` | Add section: personal Gemini setup (optional) |
| `docs/Running.md` | **Rewrite** for actual layout (`app/`, `npm run dev`, `.env`) — current `Running.md` describes an old monorepo that no longer exists |

### Phase 6 — Tests

| Test area | Action |
|-----------|--------|
| `app/tests/server/buildGenerateSystemPrompt.test.ts` | No change — prompts unchanged |
| `app/tests/server/newEndpoints.test.ts` | No change — schema/budget helpers unchanged |
| `app/tests/appLlmStatus.test.tsx` | Update mocks if status shape text changes (`gemini` vs `vllm-glm-52`) |
| `app/tests/api/llmClient.test.ts` | Update comments only |
| **New:** `app/tests/server/geminiSchema.test.ts` | Unit-test OpenAI→Gemini schema converter |
| **Optional integration test** | Mock `@google/generative-ai`; verify `handleGenerate` returns `{ sections }` |

Run:

```powershell
cd app
npm test
```

### Phase 7 — Manual verification checklist

1. **Start dev server:**
   ```powershell
   .\start_dev.ps1
   ```
   Or: `cd app; npm run dev` → open `http://localhost:3001`

2. **No warm-up banner** (or it disappears immediately) when `GEMINI_API_KEY` is set.

3. **Generate PRD** with title + details → document has `source: "llm"` (no fallback banner).

4. **Gap analysis** → may show 0–5 questions (not instant skip unless input is rich).

5. **Custom template** upload (`.md` with headings) → “Extracted sections: …”

6. **Reference PDF** (optional) → preview text non-empty for a text-based PDF.

7. **Regenerate with edits** → edited content respected.

8. **Export Word/PDF** → file downloads.

9. **Break glass:** rename key in `.env` → generation uses fallback banner (proves fallback still works).

### Phase 8 — Production path (optional)

If you want `npm run build` + `node server.mjs` (not just Vite dev):

1. Add `express`, `http-proxy-middleware`, `@google/generative-ai`, `dotenv` to **dependencies**
2. Add npm scripts to `app/package.json`:
   ```json
   "build": "tsc -b && vite build",
   "start": "node server.mjs"
   ```
3. Ensure `GEMINI_API_KEY` is set in the environment when running `npm start`
4. Server listens on `PORT` (default `80` in `server.mjs` — use `PORT=3000` locally)

---

## 8. Running locally (quick reference for you)

### First-time setup

```powershell
# 1. Go to the app folder
cd c:\Users\vincy\Downloads\prd-generator-main\prd-generator-main\app

# 2. Install packages (remove @Orggadp/XYZ-sdk from package.json first if install fails)
npm install

# 3. Create secrets file (NOT committed to git)
copy .env.example .env
# Edit .env in any text editor — paste your GEMINI_API_KEY

# 4. Start
npm run dev
```

Open **http://localhost:3001** (Vite default in this project).

### Daily use

```powershell
cd app
npm run dev
```

Or from repo root: `.\start_dev.ps1`

---

## 9. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Free tier rate limits / daily caps | Keep deterministic fallback; show clear error in server logs; user can retry later |
| Large documents hit `maxOutputTokens` | Keep `GEMINI_GENERATE_MAX_TOKENS` env override (default 8192); log `finishReason` |
| `server.mjs` / `vite.config.ts` drift | Single PR touches both; add sync comment; long-term: codegen or shared `llm-server-core.mjs` copied at build |
| JSON schema strictness differs from Cluster | Keep plain-JSON retry path; test all four LLM endpoints |
| `npm install` fails on `@Orggadp/XYZ-sdk` | Remove unused private package from `package.json` |
| Accidental key commit | `.gitignore` + `git status` habit + rotate key if leaked |

---

## 10. Files touched (implementation checklist)

| File | Change type |
|------|-------------|
| `app/server.mjs` | **Major** — replace Cluster with Gemini |
| `app/vite.config.ts` | **Major** — mirror Gemini client in `createLlmDevPlugin` |
| `app/package.json` | Add `@google/generative-ai`, `express`, `http-proxy-middleware`, `dotenv`; remove `@Orggadp/XYZ-sdk` |
| `app/.env.example` | Document Gemini vars |
| `app/src/api/llmClient.ts` | Minor — timeout comments |
| `app/tests/appLlmStatus.test.tsx` | Minor — mock state strings |
| `docs/Running.md` | Rewrite for current structure |
| `AGENTS.md` | Optional Gemini secrets section |

**Not touched:** `app/src/generation/**`, `app/src/features/**`, export, session memory, section schemas.

---

## 11. Success criteria

The migration is **done** when:

1. With a valid `GEMINI_API_KEY` in `app/.env`, a full PRD/TRS/UX generation completes with **LLM content** (no fallback banner).
2. Gap analysis, template extract, and PDF context extract work against Gemini.
3. `npm test` passes in `app/`.
4. No API key appears in `git diff` or tracked files.
5. `docs/Running.md` accurately describes how **you** run the app on Windows.

---

## 12. Order of work for the implementation prompt

When you are ready, prompt the agent with something like:

> “Implement `docs/NewPersonalPlan.md` Phase 1–7. I have added `GEMINI_API_KEY` to `app/.env`.”

Suggested implementation order:

1. Fix `package.json` dependencies (Gemini SDK + express; remove XYZ SDK if needed)
2. Implement `callGemini` + schema helper in `server.mjs`; wire all handlers
3. Mirror in `vite.config.ts` `createLlmDevPlugin`
4. Update `.env.example` and tests
5. Manual smoke test per Phase 7 checklist
6. Update `docs/Running.md`

---

## Appendix A — Endpoint payload reference (unchanged)

See `docs/DeveloperDocs.md` §13 for full request/response shapes. The frontend will keep sending the same JSON bodies; only the server’s upstream call changes.

## Appendix B — Prompt pipeline (unchanged)

`buildGenerateSystemPrompt`, `GAP_ANALYSIS_SYSTEM_PROMPT`, `TEMPLATE_EXTRACT_SYSTEM_PROMPT`, `INNOVATION_ASSISTANCE` temperature map, and all `*_GUIDANCE` tables remain the intellectual core of the product — **do not rewrite** unless Gemini output quality requires tuning after the transport swap.

## Appendix C — Relation to deleted / stale docs

| Document | Trust level |
|----------|-------------|
| `docs/DeveloperDocs.md` | **High** — matches current `app/` layout |
| `docs/UserManual.md` | **High** — user-facing behavior still accurate |
| `docs/Running.md` | **Low** — describes old `server/src/` monorepo; ignore until rewritten |
| `docs/MigrationAnalysis0.md` | **Stale** — pre-LLM / pre-XYZ-template analysis; historical only |
| `AGENTS.md` | **Partial** — XYZ OAuth proxy docs; LLM section needs Gemini addendum |
