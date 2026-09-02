# XYZ Migration Analysis

> Analysis basis: direct repository inspection (this document's author had live tool access to the
> repository file tree, `Dockerfile`, `package.json`, `package-lock.json`, and — from the
> prior `docs/QA0.md` audit performed in this same session — full inspection of `server/src/**`,
> `web/src/**`, `shared/src/**`, and `tests/**`) plus `docs/WhatIFoundAboutXYZ.md` as the sole
> source of XYZ platform information. No XYZ repository access exists or is assumed.

---

## 1. Executive Summary

**Critical correction to the starting premise**: the Dockerfile presented in your prompt as
"found in the current application" is **not present anywhere in this repository** (CONFIRMED —
repo-wide search for `server.mjs`, `docker-entrypoint.sh`, `MY_GITHUB_TOKEN`,
`http-proxy-middleware`, `npm.pkg.github.com` returns zero matches outside your two pasted
documents). It is structurally identical to the `docker/node20.11/Dockerfile` described inside
`docs/WhatIFoundAboutXYZ.md`'s own file tree — it is the **XYZ template's** Dockerfile, not
this application's. The current application's actual [Dockerfile](../Dockerfile) is a much
simpler two-stage `node:20-alpine` build with no proxy, no OAuth, no GitHub Packages
authentication, no custom entrypoint, and `EXPOSE 3000` (not `80`).

This changes the shape of the investigation: the "Docker complexity" you were concerned about
carrying over is **not baggage this application currently has** — it's baggage that exists in
the *target template*, independent of anything this app does. The real question is not "how do
we strip our app's deployment complexity" but "does our app's actual architecture fit inside a
template that was designed for a different shape of application."

**What SpecPilot actually is** (CONFIRMED, cross-referenced with `docs/QA0.md` from this
session's earlier audit): a full-stack TypeScript monorepo — a React 18 + Vite frontend
(`web/`), a stateless Express 4 backend (`server/`) that the frontend calls via same-origin
relative paths (`/api/generate`, `/api/export`, `/health`), and a shared contract/validation
package (`shared/`) — that deterministically generates PRD/TRS/UX documents from two text
fields and exports them to Word/PDF/HTML. It has **no database, no authentication, no external
API calls, and no LLM** (explicit ADR decision, see [adr/ADR-DETERMINISTIC.md](../adr/ADR-DETERMINISTIC.md)).

**The single most important architectural finding**: the XYZ template
(`docs/WhatIFoundAboutXYZ.md`) is built around a **frontend-only** deployment model — a React
app whose `server.mjs` serves static files and **proxies API calls to an already-existing,
separately-deployed backend** (`BACKEND_URL`) with OAuth token injection. SpecPilot does not
have a separate, already-deployed backend to proxy to — **its backend is bespoke application
code that must run somewhere**. This is the crux of the migration decision, and it is not yet
resolvable from available information (see §11, Q1).

**Secondary but significant finding**: because SpecPilot's generation and export logic is
already pure, deterministic, side-effect-free TypeScript with no I/O, no persistence, and no
external calls (CONFIRMED — `docs/QA0.md` §2–5), there is a real, evidence-grounded possibility
that the backend could be eliminated entirely by running the same generator/exporter functions
in the browser instead of on a server — which would make SpecPilot a pure static frontend and
sidestep the XYZ proxy/OAuth/backend question altogether. This is an **inference**, not a
confirmed plan (see §12, Option C).

This analysis does not yet have enough information to make a final MIGRATE vs. RECREATE call
with full confidence — one specific unknown (§11, Q1: can `server.mjs` host custom backend
routes, or is it a fixed platform-owned proxy shell?) is the single fact that would most change
the recommendation.

---

## 2. What We Know About the Current Application

CONFIRMED, from direct repository inspection (this session's earlier `docs/QA0.md` audit plus
fresh verification of `package.json`, `package-lock.json`, and `Dockerfile` for this analysis):

- **Type**: A monorepo-style single npm package (no `workspaces` field) containing three
  TypeScript source roots: `shared/src/`, `server/src/`, `web/src/`, plus `tests/`.
- **Frontend**: React 18 + Vite 5, entry [web/src/main.tsx](../web/src/main.tsx), single page
  (`App` → `ThemeProvider` → `AppShell` → `InputForm`/`OutputView`/`ExportControls`), dark theme
  only, no routing library, no client-side router.
- **Backend**: Express 4, entry [server/src/index.ts](../server/src/index.ts), three routes:
  `GET /health`, `POST /api/generate`, `POST /api/export` ([server/src/http/app.ts](../server/src/http/app.ts)).
- **Shared package**: Zod schemas, validation, filename logic ([shared/src/](../shared/src)),
  imported by both frontend and backend via relative paths (no package boundary).
- **What it does**: takes a product title + free-text details + a selection of PRD/TRS/UX, runs
  three deterministic template-string generators (`buildPrd`/`buildTrs`/`buildUx`), displays the
  result in an editable textarea, and exports to `.docx` (via the `docx` npm package), a
  hand-rolled single-page PDF, or a self-contained HTML file.
- **Dependencies** (CONFIRMED from [package.json](../package.json)): `docx`, `express`, `react`,
  `react-dom`, `zod` (runtime); Vite/Vitest/Testing-Library/TypeScript/Supertest/jsdom (dev).
  **All are public npm registry packages** — no `@scope/private-package` dependency exists
  anywhere in `package.json`.
- **No authentication, no user accounts, no database, no external API/LLM calls** — explicit
  non-goals in [Spec.md](../Spec.md) and [adr/ADR-DETERMINISTIC.md](../adr/ADR-DETERMINISTIC.md).
- **Statelessness**: every request is processed in memory; `Cache-Control: no-store` is set on
  every response; nothing is persisted server-side (CONFIRMED, `docs/QA0.md` §1).

This is a genuinely full-stack application with a real, non-trivial backend (generation logic,
export logic, validation) — it is emphatically **not** "a frontend with a thin Node wrapper" in
the sense of having no real server-side behavior. The server-side code is small in line count
but is where all of the document-generation and file-export logic actually lives.

---

## 3. Current Architecture

```
Browser
  ├── React SPA (web/src) ── same-origin fetch ──→ Express (server/src)
  │                                                    ├── POST /api/generate → genService → prdGen/trsGen/uxGen (pure, in-memory)
  │                                                    ├── POST /api/export   → exportService → docx / hand-rolled PDF / HTML string
  │                                                    └── GET /health
  └── shared/src (Zod contract + validation + filename logic) — imported by both sides
```

- **Frontend/backend relationship**: same-origin, direct fetch calls to relative paths
  (`/api/generate`, `/api/export`) — CONFIRMED in [web/src/api/client.ts](../web/src/api/client.ts).
  There is **no `BACKEND_URL`-style external service** anywhere in this application; the "backend"
  is this repository's own `server/` code, not a separately deployed service.
- **Dev-mode topology**: two independent local processes — `npm run dev` (Vite, frontend) and
  `npm run dev:server` (`vite-node server/src/index.ts`, Express on port 3000) — with Vite's dev
  proxy forwarding `/api` and `/health` to `localhost:3000` (CONFIRMED — [vite.config.ts](../vite.config.ts)).
  This proxy is a **development convenience only**; it plays no role in production.
- **Production topology as currently built**: the [Dockerfile](../Dockerfile) builds the Vite
  frontend into `dist/` and separately copies `server/` + `shared/` source into the runtime
  image, then runs the Express server directly via `node --experimental-strip-types
  server/src/index.ts` (no bundling/compilation of the server). **Confirmed gap** (carried over
  from `docs/QA0.md` §10.5): the Express app never calls `express.static`, so nothing in the
  current production setup actually serves the built `dist/` assets — this is a pre-existing
  defect in the current app, independent of any XYZ migration.
- **No proxy, no reverse-proxy middleware, no OAuth, no token injection anywhere in this
  application's own code** (CONFIRMED — no `http-proxy-middleware`, `axios`, `oauth`, or
  `jsonwebtoken` in `package.json`; only `docx`, `express`, `react`, `react-dom`, `zod`).

---

## 4. Current Deployment Architecture

What the **actual** [Dockerfile](../Dockerfile) in this repository does (CONFIRMED, re-read for
this analysis):

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build          # vite build → dist/

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
EXPOSE 3000
HEALTHCHECK ... CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "--experimental-strip-types", "server/src/index.ts"]
```

- Two stages: build (produces `dist`) and runtime (copies `dist`, `server`, `shared`, runs
  the server directly from TypeScript source via Node's experimental type-stripping — no
  separate compile/bundle step for the server).
- `EXPOSE 3000`, health check hits `/health` on the same port the app already listens on.
- **No GitHub Packages auth, no `.npmrc` generation, no custom entrypoint script, no
  `server.mjs`, no proxy/OAuth dependencies** anywhere in this file or elsewhere in the repo.
- [deploy/README.md](.`README.md`) documents `docker build`/`docker run` and a smoke
  check hitting `/health`; no Kubernetes/Helm artifacts exist in this repository.

**This entire Docker setup is deployment-specific, not application-specific** — none of the
generation/export/validation logic depends on Docker, and the app already runs identically via
`npm run dev` + `npm run dev:server` without any container involved.

---

## 5. Dockerfile Analysis

Since the Dockerfile pasted in your prompt does not exist in this repository, this section
analyzes the **actual current Dockerfile** and separately notes what the **pasted (XYZ
template) Dockerfile** implies, so both are on record.

| Element (actual current Dockerfile) | Application-specific or deployment-specific? |
|---|---|
| `FROM node:20-alpine` (both stages) | Deployment/runtime choice — the app has no native-Node-version-specific code (CONFIRMED, no native modules in `package.json`) |
| `npm ci` / `npm run build` | Deployment plumbing that invokes an application-defined script (`build: "vite build"`) — the script itself is application-owned, the invocation is deployment |
| `COPY server ./server`, `COPY shared ./shared` | Deployment plumbing reflecting the current repo's own directory layout |
| `CMD ["node","--experimental-strip-types","server/src/index.ts"]` | Deployment/runtime choice — running TS directly instead of compiling is a build/deploy decision, not an application behavior |
| `EXPOSE 3000` / `HEALTHCHECK ... /health` | Deployment plumbing; `/health` itself is application-defined ([server/src/http/app.ts](.`app.ts`)) |

| Element (pasted/XYZ-template Dockerfile — NOT part of this app) | Note |
|---|---|
| `ARG MY_GITHUB_TOKEN` + `.npmrc` generation | Template-provided, generic support for private packages — **this application has zero private-package dependencies, so this mechanism is entirely inapplicable to SpecPilot today** (CONFIRMED — no `@scope` deps in `package.json`/`package-lock.json`) |
| `COPY --from=src server.mjs .` | This file does not exist in the current app; it is the XYZ template's own runtime server |
| `RUN npm install --no-package-lock express@4 http-proxy-middleware@3` | Installed for the template's `server.mjs`, not for anything in this repository |
| `docker-entrypoint.sh` | Does not exist in this repository |
| `EXPOSE 80` | Template's own port convention — this app currently exposes/uses 3000 |

**Conclusion**: none of the GitHub Packages / OAuth / proxy complexity is something this
application needs to "shed" — it was never part of this application. It is part of the
*target* template's baseline, and applies uniformly regardless of what gets deployed through it.

---

## 6. `server.mjs` Analysis

**`server.mjs` does not exist anywhere in this repository** (CONFIRMED — repo-wide search).
There is therefore nothing in the current application to "inspect exactly" for this section.

What can be said, grounded in `WhatIFoundAboutXYZ.md` (the only source describing
`server.mjs`), distinguishing template facts from this-application facts:

- Per `WhatIFoundAboutXYZ.md`, the template's `server.mjs` (a) serves static files from
  `dist`, (b) proxies `/_api/*` to a configurable `BACKEND_URL` after stripping the prefix, (c)
  optionally injects an OAuth client-credentials Bearer token into proxied requests, (d) falls
  back to `index.html` for SPA routing. This is **XYZ-template-documented behavior**, not
  something observed in this repository.
- SpecPilot's own equivalent responsibilities are currently split across two different files:
  static-file serving is **missing entirely** (confirmed gap, §3), and API handling is done by
  [server/src/http/app.ts](.`app.ts`) — which is real application logic
  (`/api/generate` → `genService.generate()` → template generators; `/api/export` →
  `exportService.buildExport()`), not a generic reverse proxy.
- **Whether the template's `server.mjs` could remain/be reused/be replaced under XYZ for this
  app is unknown** — it depends entirely on whether XYZ allows `server.mjs` to be modified to
  host custom Express routes (SpecPilot's actual API logic) or whether it is a fixed,
  platform-owned file that only supports the serve+proxy+OAuth pattern verbatim. This is not
  answerable from `WhatIFoundAboutXYZ.md` and is the single most consequential open
  question (§11, Q1).
- **Could it be eliminated?** Only if SpecPilot's generation/export logic is moved to run
  entirely client-side (see §12, Option C) — in which case no backend, and therefore no
  `server.mjs` extension or `BACKEND_URL`, would be needed at all. This is a real possibility
  given the generators' purity (§2), but is an inference requiring validation, not a confirmed
  path.

---

## 7. `docker-entrypoint.sh` Analysis

**`docker/node20.11/docker-entrypoint.sh` does not exist anywhere in this repository**
(CONFIRMED). There is no current-application entrypoint script to analyze.

Per `WhatIFoundAboutXYZ.md`'s own file-tree annotation, the template's entrypoint
"Generates env-config.js, starts Node" — i.e., its two known responsibilities are:

| Responsibility (per `WhatIFoundAboutXYZ.md`) | Classification |
|---|---|
| Generating `env-config.js` (to expose `VITE_*`-prefixed variables to the browser via `window.__env__` at container **start time**, not build time) | Runtime configuration / environment substitution — a template/platform mechanism for runtime-configurable browser variables |
| Starting the Node process | Startup logic / deployment plumbing |

Whether these responsibilities are "still necessary under XYZ" is not a meaningful question
for *this* script, since it isn't part of this application. The meaningful open question is
whether SpecPilot needs an equivalent runtime-injected browser-config mechanism at all —
**currently it does not appear to** (CONFIRMED — no `VITE_*` environment variables, no
`window.__env__`-style config, and no build-time-vs-runtime config split exist anywhere in
SpecPilot's frontend; its only environment variable is `PORT`, consumed server-side only, per
`QA0.md` §10 "Environment Variables" table).

---

## 8. Dependency and Package Registry Analysis

**A. What the current application requires from its package ecosystem** (CONFIRMED):

- [package.json](.`package.json`) dependencies: `docx`, `express`, `react`, `react-dom`, `zod`
  (all public npm registry packages, standard semver ranges, no `@scope/` private packages).
- devDependencies: standard public tooling (`vite`, `vitest`, `@testing-library/*`,
  `@vitejs/plugin-react`, `typescript`, `supertest`, `jsdom`, `@types/*`) — all public.
- Direct search of [package-lock.json](.`package-lock.json`) for `npm.pkg.github.com` or any
  `@Orggadp`/`@[org]`-style scoped package reference returns **zero matches**.
- No `.npmrc` file exists anywhere in this repository (confirmed by direct file lookup).
- **Conclusion: the current application has no dependency on GitHub Packages, no private
  registry requirement, and no need for a GitHub PAT at build or runtime.** The `MY_GITHUB_TOKEN`
  mechanism described in the pasted Dockerfile is unused by this app because it belongs to the
  template, not to SpecPilot.

**B. What XYZ will need to provide/change**: **Nothing, based on current information** — since
no private package is required today, the GitHub Packages support built into the XYZ template
is simply inert/unused for this migration. This is not a gap requiring platform confirmation
*today*. It would only become relevant if a future dependency (e.g., a "XYZ SDK" package
mentioned in `WhatIFoundAboutXYZ.md`'s own Quick Start section) is later introduced —
that is a forward-looking note, not a current blocker.

---

## 9. XYZ Facts Relevant to This Application

Strictly from `WhatIFoundAboutXYZ.md`; nothing else assumed.

### Confirmed (explicitly stated in `WhatIFoundAboutXYZ.md`)
- Application code must live under `app/` in the target repository, with `app/src/` as the
  frontend source root.
- The template is React + TypeScript + Vite.
- Production serving is Node.js/Express (`server.mjs`), explicitly "no nginx."
- `server.mjs`'s documented responsibilities: serve `dist` static files, proxy `/_api/*` to
  `BACKEND_URL` (stripping the prefix), optionally inject an OAuth client-credentials Bearer
  token, and fall back to `index.html` for SPA routing.
- Default ports: `80` in production, `3001` in local dev.
- `PORT` is a documented server-side environment variable (default `80` prod / `3001` dev),
  implying the runtime does read `PORT` from the environment rather than hard-coding it.
- Browser-exposed config uses a `VITE_*` naming convention, injected at container start via a
  generated `env-config.js`, read in-browser via `window.__env__` — i.e., a runtime (not
  build-time) configuration model for browser-visible variables.
- Server-side-only variables include `BACKEND_URL`, `OAUTH_TOKEN_URL`, `OAUTH_CLIENT_ID`,
  `OAUTH_CLIENT_SECRET`, `OAUTH_AUDIENCE`, `OAUTH_SCOPE`.
- Private package support via GitHub Packages is optional/conditional (`MY_GITHUB_TOKEN` only
  used "if set").
- Containerization is via Docker Buildx + `docker-bake.hcl`; images publish to
  `ghcr.io/Orggadp/<repo-name>`; deployment is via Helm charts under `deployment/`.
- Explicit guidance: "If you are planning to connect the frontend application with the backend
  and use it in XYZ, do not use a cookie-based approach" — i.e., XYZ's documented pattern for
  frontend↔backend auth is token/bearer-based, not cookie-based.
- CI/CD (GitHub Actions) builds, tests (build succeeds), publishes images on merge to `main`,
  and opens GitOps PRs to bump image tags — i.e., CI/CD and image publishing are platform/repo
  template responsibilities, not something the application author configures from scratch.

### Inferred (reasonable deduction, not explicitly stated)
- The template's architecture assumes the "backend" is an **already-existing, separately
  deployed service** reachable at `BACKEND_URL` — the template does not describe a pattern for
  an application that ships its own backend logic colocated with its frontend in the same
  repository/container. This is inferred from the proxy-to-external-URL design and the absence
  of any mention of custom backend route registration in `server.mjs`.
- Because `server.mjs` is described as a fixed template file with a specific, named
  responsibility set (serve + proxy + OAuth), it is plausible — but not confirmed — that it is
  intended to be used largely as-is rather than freely extended with arbitrary custom routes.
- Node 20.11+ is very likely compatible with the current app's `node:20-alpine` base (same major
  version), making a Node-version mismatch an unlikely source of friction — but the *exact*
  supported patch/LTS policy for XYZ is not stated.

### Unknown (requires platform/XYZ team confirmation)
- Whether `server.mjs` can be extended with custom backend route handlers (i.e., can SpecPilot's
  `/api/generate` and `/api/export` logic run inside the XYZ container at all), or whether
  XYZ strictly expects a frontend-only app that talks to a backend deployed elsewhere.
- Whether an application without any `BACKEND_URL`/OAuth requirement (as SpecPilot currently is)
  is a supported/normal configuration, or whether the proxy+OAuth scaffolding is mandatory
  infrastructure that must be present regardless.
- Whether GitHub Packages / an internal registry is reachable from XYZ's build environment at
  all (moot for SpecPilot today, per §8, but relevant if this changes).
- Exact Node.js version/LTS policy enforced by XYZ, beyond the template's own Dockerfile
  default.
- Whether `PORT` is injected by the XYZ platform at runtime or must be read from a fixed value
  by convention.
- Whether health-check conventions (`/health`, wget-based Docker `HEALTHCHECK`) are
  XYZ-recognized or whether XYZ expects a different health-check contract (e.g., Kubernetes
  readiness/liveness probe paths, defined via Helm `values.yaml` rather than the Dockerfile).

---

## 10. Migration Constraints

Actual constraints discovered (not hypothetical):

1. **Directory shape mismatch**: XYZ requires a single `app/src/` frontend root; SpecPilot is
   a three-part monorepo (`web`, `server`, `shared`) with relative-path coupling between all
   three (CONFIRMED, `QA0.md` migration assessment from earlier in this session).
2. **Backend hosting is undefined in the target model**: SpecPilot has real backend logic with
   no external service to point a `BACKEND_URL` at — the template's proxy model does not
   obviously accommodate this (§6, §9-Inferred).
3. **No auth model overlap**: SpecPilot has zero authentication; XYZ's documented pattern
   (OAuth client-credentials via `server.mjs`) is designed for authenticating to an external
   backend — not applicable unless SpecPilot's design changes.
4. **No private dependencies to migrate** (§8) — this specific constraint that the user
   anticipated turns out **not** to apply.
5. **Existing static-serving gap** (§3): the current app's Express layer never serves its own
   `dist` output — this defect is moot if `server.mjs` (or an equivalent) takes over static
   serving, but would need fixing if the current `server/http/app.ts` were reused as-is for that
   purpose.
6. **Port convention differs** (3000 vs. 80) — trivial, since the current app already reads
   `PORT` from the environment (CONFIRMED — [server/src/index.ts](.`index.ts`):
   `Number(process.env.PORT ?? 3000)`), and Express's default `listen()` behavior with no
   explicit host binds to all interfaces, satisfying an "any port, any interface" runtime
   contract without code change.

---

## 11. Open Questions for XYZ / Platform Team

**Q1 — Can `server.mjs` be extended with custom backend routes, or is it a fixed proxy shell?**
*Why it matters*: This is the single fact that most determines the migration strategy. If yes,
SpecPilot's existing `genService`/`exportService`/`http/app.ts` logic can likely be ported into
(or alongside) `server.mjs` with modest effort (Option A/B). If no, SpecPilot's backend has
nowhere to run inside the XYZ container as currently architected, forcing either (a) hosting
the backend as a separate `BACKEND_URL` service outside this XYZ app, or (b) eliminating the
backend by moving generation/export logic into the browser (Option C variant, §12).
*Architectural decision depending on it*: whether SpecPilot ships as "frontend + own backend
merged into the container" or "frontend-only, backend elsewhere" or "frontend-only, no backend
at all."

**Q2 — Is a `BACKEND_URL`/OAuth configuration mandatory, or can an application ship with neither
configured (no backend, no proxy target)?**
*Why it matters*: SpecPilot genuinely has no external backend and no auth requirement. If the
template mandates a configured `BACKEND_URL`, that's a structural mismatch requiring either an
artificial backend endpoint or a template deviation.
*Decision depending on it*: whether SpecPilot can be a "pure static" XYZ app at all.

**Q3 — Does XYZ's build pipeline execute `npm run build` as documented (or another
convention), and is `dist` (produced by `vite build`) an acceptable, unmodified build output for
XYZ's static-serving step?**
*Why it matters*: SpecPilot's `vite.config.ts` already outputs to `dist` with default settings
(no custom `base`, no code-splitting config) — confirming this is accepted avoids any Vite
config changes.
*Decision depending on it*: whether the existing `vite.config.ts` can be reused unmodified.

**Q4 — What is the actual, current supported Node.js version/policy for XYZ deployments (exact
minimum, not just what one template's Dockerfile happens to pin)?**
*Why it matters*: confirms whether `node:20-alpine` (current app's assumption) remains valid or
needs bumping; low risk given both environments target Node 20, but not yet independently
confirmed as a live platform policy rather than one template's snapshot.
*Decision depending on it*: whether any Node-version-sensitive code (none currently identified)
needs adjustment — likely none, but should be confirmed rather than assumed.

**Q5 — Does XYZ inject `PORT`, or must the app assume a fixed port (e.g., always 80) with no
override?**
*Why it matters*: SpecPilot's server already reads `process.env.PORT`; if XYZ injects a
different value, no code change is needed. If XYZ requires a hard-coded port, a one-line
default change may be needed only for clarity, not functionality.
*Decision depending on it*: none significant — this is a low-risk item, but confirming avoids
guessing at container networking behavior.

**Q6 — What health-check contract does XYZ/Kubernetes expect (HTTP path, method, expected
response), and is SpecPilot's existing `GET /health` → `{status:"ok"}` compatible as-is?**
*Why it matters*: SpecPilot already has a working, tested health endpoint
([tests/http/generate.test.ts](.`generate.test.ts`) sibling tests confirm `/health`
behavior via `QA0.md` §10.8); confirming compatibility avoids rework.
*Decision depending on it*: whether the existing `/health` route can be reused unchanged or
needs to be exposed differently (e.g., via Helm `values.yaml` probe configuration instead of
Dockerfile `HEALTHCHECK`).

**Q7 — If private packages are never required (confirmed true for SpecPilot today), is any part
of the GitHub Packages/`.npmrc` machinery still mandatory to include, or can it be omitted
entirely for apps that don't need it?**
*Why it matters*: avoids carrying inert, unused build-time complexity into the new repository
purely because the template includes it by default.
*Decision depending on it*: whether the `.npmrc`/`MY_GITHUB_TOKEN` scaffolding can be safely
deleted/ignored in SpecPilot's XYZ repository copy.

---

## 12. Migration Options

### Option A — Minimal Migration

Move `web/src/**` into `app/src/**` largely as-is, move `shared/src/**` alongside it (or inline
its exports into `app/src/`), and attempt to fit `server/src/**`'s API logic into (or alongside)
the XYZ `server.mjs`.

- **What can be reused**: all React components (`AppShell`, `InputForm`, `OutputView`,
  `ExportControls`, `ThemeProvider`), the `src` contract/validation/naming logic, and —
  contingent on Q1 — the generation (`prdGen`/`trsGen`/`uxGen`) and export
  (`buildWord`/`buildPdf`/`buildMockup`) logic, since none of it is deployment-specific.
- **What must change**: directory layout (three roots → one `app/` root), the API-call path
  convention (`/api/*` → the template's `/_api/*` proxy convention, if the proxy path is
  retained), and the entire backend-hosting question (Q1) must be resolved before this option is
  even fully specified.
- **What Docker-specific pieces disappear**: the current app's own Dockerfile,
  `EXPOSE 3000`, and its `HEALTHCHECK` — XYZ owns containerization entirely, per your stated
  premise.
- **XYZ-specific changes required**: adopting `app/`-rooted structure, and — pending Q1 —
  either extending `server.mjs` or standing up SpecPilot's Express logic as a `BACKEND_URL`
  target.

### Option B — Refactor Existing Application

Same functional scope as Option A, but consolidate `shared` into `web`'s (now `app/`'s) source
tree to remove the current relative-import coupling (§10 point 1), and — if Q1 confirms
`server.mjs` can be extended — cleanly integrate SpecPilot's three API routes as first-class
routes inside a modified `server.mjs`, fixing the pre-existing static-serving gap (§3) as part
of that consolidation rather than carrying it forward.

- Removes the current dual-validation-layer duplication (Zod schema gate + hand-written
  `validate()`, `QA0.md` §11) if convenient during the move, since both already live in
  `shared` and would move together regardless.
- Fixes the PDF 50-line truncation and Word Markdown-blindness only if explicitly chosen to —
  these are pre-existing defects unrelated to the migration itself, not migration requirements.

### Option C — Recreate Application for XYZ

Rebuild the frontend directly in `app/src/` using the template's own conventions (routes/,
api/client.ts pattern), and re-implement the three document generators and three exporters as
either (C1) new backend route handlers integrated into `server.mjs`, or (C2) **client-side pure
functions running entirely in the browser**, eliminating the backend altogether.

**C2 is grounded in real repository evidence, not speculation**: SpecPilot's
`buildPrd`/`buildTrs`/`buildUx` are pure functions with no I/O (CONFIRMED,
server/src/core/*.ts); `buildWord` uses the `docx` package, and
`buildPdf`/`buildMockup` are pure string/Buffer construction with no server-only APIs used
(CONFIRMED, [server/src/app/exportService.ts](.`exportService.ts`)). None of
these six functions touch the filesystem, a database, or a network call. This makes "move these
functions to run in the browser and produce a Blob for download instead of an HTTP response" a
plausible re-architecture — **plausible, not verified**: whether the `docx` package's
`Packer.toBuffer()` API functions identically in a browser bundle (vs. Node) has not been tested
in this session and should be validated with a small spike before committing to this path.

- If C2 holds, SpecPilot becomes a 100% static frontend — no `BACKEND_URL`, no OAuth, no proxy,
  no `server.mjs` extension question at all (Q1/Q2 become moot for this app).
- If C2 does not hold (e.g., `docx` truly requires Node), the generation logic (pure, portable)
  can still move to the browser, while only the Word export step must remain server-side.

---

## 13. Option Comparison

| Dimension | A — Minimal | B — Refactor | C — Recreate |
|---|---|---|---|
| Complexity | Low code change, but blocked on Q1 | Moderate; removes existing coupling/defects | Low-to-moderate, but resolves Q1/Q2 entirely if C2 holds |
| Migration effort | Lowest, assuming Q1 resolves favorably | Moderate | Moderate (mostly relocating already-pure functions, not rewriting logic) |
| Risk | High until Q1/Q2 answered — could hit a dead end mid-migration | Medium — same Q1/Q2 dependency, but cleaner base | Lowest architecturally if C2 is validated, since it removes the unresolved backend-hosting question entirely |
| XYZ compatibility | Uncertain — depends entirely on Q1 | Uncertain — same dependency | Potentially very high if C2 holds (pure static app fits the "simplest XYZ shape" cleanly) |
| Maintainability | Inherits current dual-validation and static-serving defects unless separately fixed | Best of migration options — fixes real defects during the move | Requires re-verifying exporter behavior in a browser context; new but small surface area |
| Deployment simplicity | Same as B/C, since Docker is XYZ-owned regardless | Same | Highest, if no backend is needed at all |
| Dependency management | No private deps either way (§8) | Same | Same |
| Long-term suitability | Weak until Q1/Q2 resolved | Reasonable | Strong candidate **if** the client-side generation/export inference is validated |

**No option can be conclusively favored yet** — A and B are both blocked on the same unresolved
question (Q1), and C's strongest variant (C2) rests on one unverified technical assumption
(browser compatibility of the `docx` export path) rather than a platform unknown.

---

## 14. Recommended Architecture

**This recommendation is conditional and should not be treated as final** until Q1 (§11) is
answered, because it is the fact that most changes the answer:

- **If Q1 confirms `server.mjs` can be extended with custom routes**: Option B (refactor) is
  recommended — port `src` + `src` into `app/src`, extend `server.mjs` with
  SpecPilot's three existing routes (`/health`, `/api/generate`, `/api/export`, or their `/_api`
  equivalents), and use the migration as an opportunity to fix the pre-existing static-serving
  gap and validation-layer duplication (§3, §10) that already exist independent of XYZ.
- **If Q1 disallows extending `server.mjs`, or if a small spike validates that the `docx`
  export and generation logic work identically in a browser context**: Option C2 (recreate as a
  pure static frontend) becomes the stronger recommendation, since it eliminates the
  backend-hosting question entirely rather than working around it, and matches the "simplest
  correct XYZ-compatible architecture" goal you stated at the outset.
- Either way, **Option A (bolt the current structure on unchanged) is not recommended** even in
  the best case, because it would carry forward two confirmed pre-existing defects (static
  file serving gap, dual validation layers) into a fresh deployment for no benefit.

---

## 15. Proposed Migration Plan (Not Implemented)

1. **Resolve Q1 and Q2 with the platform team** — this blocks a confident choice between
   Option B and Option C2.
2. **Run a small, isolated spike** (not part of this migration) to confirm whether `docx`'s
   `Packer.toBuffer()` (or equivalent browser output method) works unmodified in a Vite-bundled
   browser context — this resolves the technical uncertainty in Option C2.
3. Based on (1) and (2), select B or C2 as the concrete target architecture.
4. Only then: plan the concrete file-by-file move/rewrite (this step intentionally deferred to
   after the Builder agent receives a resolved architectural target, per your instructions).
5. Re-validate the existing test suite's assertions (`QA0.md` §9, §12 "Must Not Break")
   against whichever target architecture is chosen, to ensure no currently-guaranteed behavior
   (e.g., "only selected document types are generated," filename convention, section ordering)
   is silently dropped during the move.

---

## 16. Expected Repository Changes

Given the unresolved Q1/Q2, this can only be stated at a high level and is not a concrete file
list yet:

- **Likely to move largely intact regardless of option chosen**: `App.tsx`,
  `AppShell.tsx`, `HelpPanel.tsx`, `InputForm.tsx`, `OutputView.tsx`, `ExportControls.tsx`,
  `ThemeProvider.tsx`, `tokens.ts`, and `contract.ts`, `validate.ts`, `naming.ts`
  (all pure, presentation/contract logic with no deployment dependency).
- **Likely to move but require route/path adaptation**: `client.ts` (adjusting the
  request path convention if the XYZ `/_api` proxy pattern is adopted).
- **Contingent on Q1/Q2 outcome**: `server/src/core/*.ts` (generators) and
  `exportService.ts` either move into a browser-executed module (Option C2) or
  into an extended `server.mjs`/backend service (Option B) — the destination differs materially
  between options.
- **Likely to be removed/replaced regardless of option**: the current Dockerfile
  and deploy/ scripts (XYZ owns containerization/deployment per your stated
  premise), and — if Option C2 is chosen — `app.ts` and `index.ts`
  entirely.
- **Likely to be created**: nothing can be specified yet without an architectural decision;
  premature to name new files before Q1/Q2 are answered.

---

## 17. Validation Strategy

Regardless of which option is chosen:

- Reuse the existing test suite's **behavioral guarantees** (`QA0.md` §12 "Must Not Break")
  as the acceptance criteria for the migrated app: identical `GenerationRequest`/
  `GeneratedDocument` shapes, identical section ordering/content per doc type, identical filename
  convention, identical export formats.
- If Option C2 (client-side generation) is chosen, the existing `tests/core/*.test.ts` and
  `exportService.test.ts` assertions should be portable almost unchanged to a
  browser/jsdom test target, since the functions under test are already pure and dependency-free
  — this itself is a good indicator of migration safety for that path.
- If Option B (extended `server.mjs`) is chosen, re-run the equivalent of
  `generate.test.ts` and `export.test.ts` against the new route
  registrations to confirm behavior parity.
- Either way, manually verify the current static-serving gap (§3) is actually fixed in the new
  architecture (i.e., that a fresh container serves the frontend at `/`), since this was never
  proven working in the current app.

---

## 18. Risks and Unknowns

- **Primary risk**: proceeding with Option A or B without an answer to Q1 could result in
  discovering mid-migration that `server.mjs` genuinely cannot host custom routes, wasting the
  effort spent adapting the current backend to fit it.
- **Primary unknown**: whether `docx`'s Word-generation API is browser-compatible as shipped —
  unverified in this session; if it is not, Option C2 degrades to "generation in-browser, export
  still server-side," which reintroduces the Q1/Q2 backend-hosting question for export only.
- **Secondary risk**: the pre-existing static-serving gap and dual-validation-layer duplication
  (§3, §10) are real defects independent of XYZ; if not addressed during the move, they will
  simply resurface in the new environment.
- **Secondary unknown**: exact XYZ health-check/readiness contract (Q6) — low risk, but
  unverified.
- Nothing in this analysis should be read as confirming XYZ's capabilities beyond what
  `WhatIFoundAboutXYZ.md` states; all XYZ-side claims above are explicitly labeled
  CONFIRMED/INFERRED/UNKNOWN per §9.

---

## 19. Final Recommendation

The evidence gathered so far is **not yet sufficient to make a final MIGRATE/REFACTOR vs.
RECREATE decision** — it is sufficient to rule out blind reuse of the current Docker/server
setup (§4–7) and to establish that SpecPilot's core logic is unusually well-suited to a
client-side-only re-architecture if that path is validated (§12, Option C2). The **one unknown
that would most change this recommendation** is Q1 (§11): whether the XYZ template's
`server.mjs` can host custom application routes. Obtain that answer, run the small `docx`
browser-compatibility spike (§15 step 2), and this analysis can be converted into a concrete,
low-risk migration plan for the Builder agent — most likely Option B if Q1 is favorable, or
Option C2 if it is not.
