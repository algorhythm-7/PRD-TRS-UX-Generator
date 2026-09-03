# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SpecPilot — a single-page React app that generates PRD, TRS, and UX documents from a product
description using **Google Gemini**, with a deterministic offline fallback when the LLM is
unavailable. Everything (frontend + LLM integration + dev proxy) lives under `app/`; the
repository root only has docs and dev-launcher scripts.

## Commands

All commands run from `app/`, not the repo root.

```powershell
cd app
npm install
npm run dev          # Vite dev server on http://localhost:3001
npm run build         # tsc -b && vite build
npm start             # node server.mjs (serves dist/, requires prior build)
npm run lint
npm run format         # prettier --write .
npm test               # vitest run
npm run test:watch
```

Run a single test file: `npx vitest run tests/generation/prdGen.test.ts`. Tests use jsdom via
`vitest.config.ts` / `tests/setup.ts`.

Root-level `start_dev.ps1` / `start_dev.sh` just `cd app && npm install (if needed) && npm run dev`.

`GEMINI_API_KEY` (from https://aistudio.google.com/apikey) must be set in `app/.env` for the LLM
path to work; without it the app still runs and silently uses the deterministic fallback.

## Architecture

### The critical constraint: server.mjs and vite.config.ts are deliberately duplicated

The entire Gemini prompt/schema/call pipeline (`DOC_TYPE_GUIDANCE`, `FORMAT_GUIDANCE`,
`buildGenerateSystemPrompt`, `callGemini`, schema builders, etc.) exists **twice**, near-verbatim:

- `app/server.mjs` — production. The Docker build copies **only this file** (plus `dist/`) into
  the runtime image, so it cannot `import` from anywhere else in the repo — it must stay
  self-contained.
- `app/vite.config.ts` (`createLlmDevPlugin`) — dev-only equivalent, used by the Vite middleware
  when running `npm run dev`.

**Any change to prompts, schemas, guidance tables, or the Gemini call logic must be applied to
both files identically**, or dev and prod behavior will silently diverge. There is no shared
module for this by design (see `docs/NewPersonalPlan.md` §2.3).

### Request flow

```
Browser (React, app/src/**)
  → fetch("/_api/gap-analysis" | "/_api/generate" | "/_api/template-extract" | "/_api/context-extract" | "/_api/llm-status" | "/_api/llm-warmup")
    → Dev:  Vite middleware (createLlmDevPlugin in vite.config.ts)
    → Prod: Express routes in server.mjs
      → callGemini(...) → JSON sections → buildGeneratedDocument() → OutputView
```

If any `/_api/*` LLM call throws, `app/src/generation/llmGenService.ts::generateOne` catches it
and falls back to the deterministic generators (`prdGen.ts` / `trsGen.ts` / `uxGen.ts`) — this
fallback is per-DocType, so one type failing never affects another in the same batch.

Everything downstream of the LLM response (export, session memory, UI) works identically
regardless of whether content came from Gemini or the deterministic fallback; `GeneratedDocument.source`
(`"llm" | "fallback"`) is the only place that distinction is threaded through.

### `app/src/` layout

- `generation/contract.ts` — the single source of truth for shared types: `DocType`, document
  formats, Generation Profile fields (depth, decomposition, traceability, innovation assistance,
  target audience, output-structure items), and Zod request schemas.
- `generation/sectionSchema.ts` — `sectionNamesFor(docType, format, ...)` is the authoritative
  ordered section list per doc type + format combination; both the LLM request (`sections` sent
  to the server) and `buildGeneratedDocument` (reconstructing headings from the LLM's response)
  must derive from the same call, or headings and returned keys will mismatch.
- `generation/prdGen.ts` / `trsGen.ts` / `uxGen.ts` — pure, deterministic template generators
  (the offline fallback; also what `genService.ts` uses directly when no LLM profile is involved).
- `generation/genService.ts` — the older, purely-deterministic orchestrator (`generate()`),
  distinct from `llmGenService.ts`'s LLM-aware `runGeneration()`/`regenerateWithFeedback()`.
- `generation/llmGenService.ts` — orchestrates gap-analysis → generate → fallback for the LLM path;
  `App.tsx` calls into this, not `genService.ts`, for real generation.
- `generation/sessionMemory.ts` — versioned `localStorage` store (`prd-gen:session-memory:v1`)
  recording each generation's Generation Profile choices plus live feedback signals (edited
  section count, thumbs-down count), used to consolidate/pre-fill future defaults via a
  recency-weighted vote (`weightedVote`, `DECAY = 0.9`). Every read/write is best-effort and must
  degrade silently if `localStorage` is unavailable or corrupted.
- `api/llmClient.ts` — typed fetch wrappers for every `/_api/*` route; `api/client.ts` is a
  separate, mostly-unused axios client for a generic `/_api` backend proxy (OAuth passthrough
  template, not used by the generation flow).
- `export/exportService.ts` — client-side Word (`docx`)/PDF/HTML-mockup export; this runs in the
  browser, not on the server.
- `App.tsx` — top-level state machine: input → (gap-analysis clarifications, if any) → Generation
  Profile screen → generation → output/export. `finishGeneration` is the one place that calls
  `runGeneration` and writes the session record.

### Docs

`docs/` contains a large volume of planning/enhancement documents (`Enhancements*.md`,
`EnhancementToDo*.md`, `GoodTRSPRDUX*.md`) that the current prompt-guidance tables in
`server.mjs`/`vite.config.ts` explicitly cite in their own code comments — when changing prompt
behavior, check whether a numbered doc section is referenced in the comment above the code you're
touching. `docs/AppArch.md` describes an **older** `shared/`+`server/`+`web/` workspace layout
that predates the current single-`app/` structure and the Gemini migration — it does not reflect
the current codebase and should not be used as an architecture reference. `docs/NewPersonalPlan.md`
documents the actual Cluster→Gemini migration and is accurate as of that migration.

### Copilot instructions

`.github/copilot-instructions.md` applies repo-wide and emphasizes: verify from source rather than
assume, keep changes tightly scoped, reuse existing patterns before introducing new abstractions,
and never change build tooling/deployment/project structure unless explicitly requested.
`.github/agents/` defines three Copilot agent personas (planner: docs/-only, read-only elsewhere;
builder: implements approved plans; auditor: strictly read-only analysis) — not directly relevant
to Claude Code sessions, but signals the repo's convention of separating planning from implementation.
