# Architecture (Updated) - SpecPilot inside the XYZ React Template

## Status

This document describes the **actual, current architecture of this repository**, after the
migration from the standalone SpecPilot project (`web/` + `server/` + `shared/`) into the XYZ
`app/` template, and after making the migrated code compile, run, and pass tests. It supersedes
the description of the old architecture in `docs/AppArch.md` for anything that talks about how
the app currently works. `docs/AppArch.md`, `docs/QA0.md`, `docs/MigrationAnalysis0.md`,
`docs/MigrationDecision1.md`, `docs/XYZAnalysis0.md`, and `docs/XYZAnalysis1.md` remain useful
as historical record of *why* things ended up this way, but they describe intermediate states,
not the current one.

**Basis:** direct inspection of the repository as of this writing (post-merge, all tests/build
green).

---

## 1. One-sentence summary

SpecPilot is now a **pure client-side React application**: everything - input validation,
document generation, and Word/PDF/HTML export - runs in the browser with zero network calls,
hosted inside the XYZ `app/` template's build/deploy/runtime shell.

## 2. Repository layout (current, actual)

```text
prd-generator-main/
|-- app/                          # XYZ-owned project root - the only Node project here
|   |-- src/
|   |   |-- main.tsx              # Active entry point (mounts <App/>)
|   |   |-- App.tsx               # Product composition + top-level state owner
|   |   |-- App.css
|   |   |-- index.css
|   |   |-- vite-env.d.ts
|   |   |-- app/                  # Shell/chrome
|   |   |   |-- AppShell.tsx
|   |   |   `-- HelpPanel.tsx
|   |   |-- theme/                # Dark theme tokens + provider
|   |   |   |-- ThemeProvider.tsx
|   |   |   `-- tokens.ts
|   |   |-- features/              # Feature UI components
|   |   |   |-- input/InputForm.tsx
|   |   |   |-- output/OutputView.tsx
|   |   |   `-- export/ExportControls.tsx
|   |   |-- generation/            # Pure domain logic: contract, validation, generators
|   |   |   |-- contract.ts        # Zod schemas + shared types (DocType, GeneratedDocument, ...)
|   |   |   |-- validate.ts        # Business-rule validation (non-empty fields, >=1 type)
|   |   |   |-- naming.ts          # Filename sanitization/prefixing
|   |   |   |-- prdGen.ts          # buildPrd() - 9 fixed sections
|   |   |   |-- trsGen.ts          # buildTrs() - 12 fixed sections
|   |   |   |-- uxGen.ts           # buildUx() - 2 fixed segments
|   |   |   |-- genService.ts      # generate() orchestrator + ValidationError
|   |   |   `-- index.ts           # barrel: re-exports contract/validate/naming only
|   |   `-- export/
|   |       `-- exportService.ts   # buildWord/buildPdf/buildMockup/buildExport -> Blob
|   |-- tests/                     # Vitest suite (mirrors src/ layout)
|   |   |-- setup.ts
|   |   |-- app/                   # AppShell, HelpPanel
|   |   |-- theme/                 # ThemeProvider + tokens
|   |   |-- features/              # InputForm, OutputView, ExportControls
|   |   |-- generation/            # contract, validate, naming, prdGen, trsGen, uxGen, genService
|   |   |-- export/                # exportService (Blob output)
|   |   |-- e2e/                   # acceptance.test.tsx - full flow through the real component tree
|   |   `-- app.test.tsx           # App-level integration tests
|   |-- public/
|   |-- index.html                 # XYZ-owned: loads /env-config.js then /src/main.tsx
|   |-- server.mjs                 # XYZ-owned: production Express static server + /_api proxy
|   |-- package.json               # XYZ base + docx/zod (runtime) + vitest/RTL/jsdom (dev)
|   |-- package-lock.json
|   |-- vite.config.ts             # XYZ-owned: dev server, /_api OAuth proxy, @ alias
|   |-- vitest.config.ts           # Added this migration: jsdom, @ alias, tests/setup.ts
|   |-- tsconfig.json / tsconfig.app.json / tsconfig.node.json
|   `-- eslint.config.js
|-- docker/node20.11/              # XYZ-owned: Dockerfile + docker-entrypoint.sh (untouched)
|-- deployment/ee/{dev,sbx}/       # XYZ-owned: Helm values (untouched)
|-- docker-bake.hcl                # XYZ-owned (untouched)
|-- docs/                          # Documentation (this file + historical migration record)
|-- AGENTS.md                      # XYZ platform/integration conventions
`-- .github/                       # Copilot instructions + agent definitions
```

**What no longer exists in this repository:** `web/`, `server/`, `shared/` (the old
three-package split), the root `tests/` directory (moved into `app/tests/`), `app/src/api/`
(the old fetch-based HTTP client), and `app/src/routes/` + `App-nex.tsx` + `main-nex.tsx` (the
XYZ template's own demo pages/entry, which conflicted with the product's single active entry
point and were removed once confirmed unused).

## 3. Runtime architecture

```text
Browser
  `-- app/src/main.tsx
        `-- <App/>                              (app/src/App.tsx)
              |-- <ThemeProvider>                (app/src/theme/ThemeProvider.tsx)
              `-- <AppShell>                     (app/src/app/AppShell.tsx)
                    |-- <HelpPanel/>              (app/src/app/HelpPanel.tsx)
                    |-- <InputForm/>              (app/src/features/input/InputForm.tsx)
                    |-- <OutputView/>             (app/src/features/output/OutputView.tsx)
                    `-- <ExportControls/>         (app/src/features/export/ExportControls.tsx)
```

There is **no backend, no `/api/*`, no `/_api/*` call, and no `fetch()` anywhere in the product
code path.** `generate()` and `buildExport()` are called directly as in-process function calls
from React event handlers. This is a deliberate architecture decision (see
`docs/MigrationDecision1.md` - "Architecture B"), not an accident of the migration: SpecPilot's
generation and export logic is fully deterministic and side-effect-free, so there was no reason
to keep a server in the loop.

### 3.1 XYZ-owned infrastructure (present, but not used by the product's own logic)

These files exist because they are part of the XYZ template contract and remain untouched:

- **`app/server.mjs`** - production Express server. Serves the built `dist/` and proxies
  `/_api/*` to `BACKEND_URL` with optional OAuth client-credentials token injection. SpecPilot
  does not call `/_api/*`, so this proxy is inert for this product, but it is not removed -
  removing XYZ-owned infrastructure was explicitly out of scope for this migration.
- **`app/vite.config.ts`** - dev server config with the same OAuth-proxy plugin, listening on
  port `3001` and forwarding `/_api` to `BACKEND_URL` (default `http://localhost:5000`). Also
  defines the `@` -> `./src` path alias used throughout the app.
- **`docker/node20.11/Dockerfile`** and **`docker-entrypoint.sh`** - multi-stage build (Node
  install -> `npm run build` -> copy `dist/` + `server.mjs` into a slim runtime image that also
  installs `express`/`http-proxy-middleware` directly, independent of `package.json`). Generates
  `env-config.js` at container start for `window.__env__` (`VITE_XYZ_*` variables).
- **`deployment/`, `docker-bake.hcl`** - Kubernetes/Helm values and Docker Buildx bake config.

None of this was modified during the migration. If a genuine backend need arises later (e.g. a
real external integration), this is the mechanism that would be used - but today it carries zero
product traffic.

### 3.2 Product code

#### State ownership (`App.tsx`)

`App` is the single owner of all cross-component state:

| State | Type | Purpose |
| --- | --- | --- |
| `documents` | `GeneratedDocument[]` | Result of the last `generate()` call |
| `contents` | `Record<string, string>` | **Current** (possibly edited) content per `DocType` - this is what gets exported |
| `active` | `DocType or null` | Which tab is currently visible - kept in sync with `OutputView`'s internal tab state via `onActiveChange` |
| `pending` | `boolean` | Passed to `InputForm` to disable the Generate button during a call (generation is synchronous, so this is mostly vestigial today) |
| `error` | `string or null` | Surfaced as `<p role="alert">` on generation failure |

`activeContent` is derived as `contents[activeDoc.type] ?? activeDoc.content` - i.e. **edited
content wins over originally generated content**. This is the fix for a bug (see section 5) where the
original SpecPilot app always exported the pristine generated text, silently discarding edits.

`OutputView` also tracks its *own* internal `active` tab and per-type `edits` map (so that typing
in a textarea doesn't require a round-trip through `App` on every keystroke), but it reports both
up to `App` via `onContentChange` and `onActiveChange` so `App`/`ExportControls` never fall out of
sync with what's actually on screen.

#### Generation layer (`app/src/generation/`)

- `contract.ts` - `DOC_TYPES`, `DOC_TYPE_LABELS`, Zod `GenerationRequestSchema` /
  `ExportRequestSchema`, and the plain TypeScript interfaces `GeneratedDocument` /
  `GenerationResponse`. This is the single source of truth for the request/response shape.
- `validate.ts` - pure `validate(request)`: non-empty title, non-empty details, >=1 selected type.
- `naming.ts` - `sanitizeBase()` / `prefixFilename()`: turns a product title into a filesystem-safe
  prefix (falls back to `"specpilot"` for an empty/whitespace title).
- `prdGen.ts` / `trsGen.ts` / `uxGen.ts` - deterministic template generators. Each exports a fixed
  section-name tuple (`PRD_SECTIONS` = 9, `TRS_SECTIONS` = 12, `UX_SEGMENTS` = 2) and a
  `build*(request)` function that interpolates `productTitle`/`productDetails` into fixed prose.
  **No LLM, no external call, no randomness, no timestamps** - identical input always produces
  identical output.
- `genService.ts` - `generate(request)`: runs `validate()` (throwing `ValidationError` with
  per-field messages on failure), then calls only the generators for `request.selectedTypes`, in a
  fixed `PRD -> TRS -> UX` order regardless of UI selection order.
- `index.ts` - barrel that re-exports `contract`/`validate`/`naming` (not `genService.ts` - that is
  imported directly by its consumers, `App.tsx` and the tests).

#### Export layer (`app/src/export/exportService.ts`)

`ExportedFile` is `{ filename: string; contentType: string; blob: Blob }` - **a real browser
`Blob`, not a Node `Buffer`.** This is the key architectural change from the old server-side
version:

- `buildWord()` - builds a `docx` `Document`/`Paragraph` tree exactly as before, but calls
  `Packer.toBlob()` (a real browser-targeted API the installed `docx` package ships) instead of
  `Packer.toBuffer()`.
- `buildPdf()` - the same hand-rolled, dependency-free PDF object-graph writer as before (still
  capped at the first 50 lines of content - this limitation was intentionally left as-is; see
  `docs/Spec.md`'s open questions), but wraps the final string in
  `new Blob([pdf], { type: "application/pdf" })` instead of `Buffer.from(...)`.
- `buildMockup()` - same HTML-escaping template logic, wrapped in `new Blob([html], { type:
  "text/html" })`.
- `buildExport(format, content, title, docType)` - the single dispatcher `ExportControls` calls.

Downloading uses the same browser-native mechanism as before
(`URL.createObjectURL` + a synthetic `<a download>` click in `ExportControls.tsx`) - this code
did not need to change at all, since a `Blob` is a `Blob` regardless of whether it came from a
`fetch()` response (old) or was constructed locally (current).

## 4. Dependencies

**Runtime (`app/package.json` -> `dependencies`):**

| Package | Used by product code? | Notes |
| --- | --- | --- |
| `react`, `react-dom` | Yes | Core framework |
| `@mantine/core`, `@mantine/hooks`, `@mantine/notifications`, `@tabler/icons-react` | No (not currently) | XYZ template baseline; the product's own components (`AppShell`, `InputForm`, etc.) use plain HTML elements, not Mantine components |
| `docx` | Yes | Word export (`Packer.toBlob`) |
| `zod` | Yes | `generation/contract.ts` schemas |
| `axios` | No | XYZ template baseline (`app/src/api/client.ts`, which used it, was deleted) |
| `react-router` | No | XYZ template baseline (the demo `routes/` that used it was deleted) |

`axios` and `react-router` were **deliberately left in `package.json`** even though nothing in the
current product imports them - removing already-declared XYZ baseline dependencies was judged
out of scope for a migration whose goal was "make it work," not "minimize the dependency tree."

**Dev (`app/package.json` -> `devDependencies`):** standard Vite/TypeScript/ESLint tooling (XYZ
baseline) plus `@Orggadp/XYZ-sdk` (present, unused by product code - same reasoning as
above) plus, added during this migration: `vitest`, `@testing-library/react`,
`@testing-library/jest-dom`, `jsdom`.

## 5. Notable bugs found and fixed during this migration

These were present in the *original* SpecPilot codebase (predating the XYZ migration) and were
only surfaced/fixed while making the migrated app actually work correctly, not just compile:

1. **Edited content never reached export.** The original `App.tsx` passed a no-op
   `onContentChange={() => undefined}` to `OutputView`, and derived `ExportControls`' `content`
   prop from the original generation response rather than any edited state. Fixed: `App` now owns
   a `contents` record updated by a real `onContentChange`, and `ExportControls` receives the
   current value from it.
2. **The export button was stuck on the first generated document type.** `App`'s `active` state
   was only ever set once, immediately after `generate()` returned - switching tabs inside
   `OutputView` (which had its own separate internal `active` state) never propagated back up. In
   practice this meant `ExportControls` (and the conditional "Download UX" button) always reflected
   whichever document type was generated *first*, not whichever tab was actually visible. Fixed:
   `OutputView` now accepts an `onActiveChange` callback and calls it both on regeneration and on
   every tab click; `App` uses it to keep its own `active` state in sync.

Both are covered by regression tests in `app/tests/app.test.tsx`, `app/tests/e2e/acceptance.test.tsx`,
and `app/tests/features/outputView.test.tsx`.

## 6. Testing

- **Runner:** Vitest, configured in `app/vitest.config.ts` (`environment: "jsdom"`, `globals:
  true` - required for `@testing-library/react`'s automatic per-test DOM cleanup to register).
- **Location:** `app/tests/`, mirroring `app/src/`'s structure.
- **Scripts:** `npm test` (`vitest run`), `npm run test:watch` (`vitest`).
- **Current status:** 16 test files, 32 tests, all passing.
- One test file (`app/tests/export/exportService.test.ts`) pins `// @vitest-environment node`
  instead of the project default `jsdom`, because jsdom's `Blob` polyfill does not implement
  `.text()`/`.slice()` the way Node's native `Blob` does - this only matters for tests that read
  Blob contents back out; the product code itself is unaffected since it runs in a real browser.
- Tests intentionally **not** ported from the old repository: anything asserting the old Express
  HTTP routes (`/api/generate`, `/api/export`), the old deployment smoke test tied to the old
  Dockerfile, and the old API-client test - all of that layer was deleted, not adapted, because
  Architecture B has no equivalent to adapt it to.

## 7. What still uses old-architecture language (not yet updated)

`docs/Running.md`, `docs/AppArch.md` (old version), `docs/Flow.md` (old version), `docs/design.md`,
`docs/QA0.md`, and the root `README.md` still describe the pre-migration `web/`/`server/`/`shared/`
architecture and the HTTP-based flow. They remain useful as historical/product-requirements
record but should not be treated as current operational documentation. This document and
`docs/FlowUpdated.md` are the current source of truth for architecture and flow.
