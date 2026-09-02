# SpecPilot — Running & Reproduction Guide

> This is a Node.js/TypeScript project (not Python). The instructions below follow the
> requested document structure, adapted to the actual stack observed in the repository.
> All commands are for Windows PowerShell, per the repository's documented workflow
> ([README.md](README.md)).

---

## Prerequisites

Confirmed from [README.md](README.md) and [Dockerfile](Dockerfile):

- **Node.js 20 or newer** (the Dockerfile base image is `node:20-alpine`).
- **npm 10 or newer**.
- **OS**: cross-platform; no OS-specific native dependencies were found in
  [package.json](package.json). Windows, macOS, and Linux are all supported for local
  development (Inferred — pure JS/TS dependency tree, no `node-gyp`/native addons listed).
- No Python runtime is required anywhere in this repository (Confirmed — no `.py` files,
  `requirements.txt`, `pyproject.toml`, or `Pipfile` exist).

---

## Environment Setup

There is no Python virtual environment step for this project. The Node.js equivalent is:

### Step 1 — Install Node.js 20+

Verify your installed version:

```pwsh
node --version
npm --version
```

### Step 2 — Install dependencies

The project has a standard `package.json` (Confirmed — [package.json](package.json)), so use
it directly. No `requirements.txt`, `pyproject.toml`, `poetry.lock`, or `Pipfile` exists in
this repository, so the "Missing Dependency Manifest" fallback is not applicable here — a
manifest is present.

```pwsh
npm install
```

This installs the runtime dependencies (`docx`, `express`, `react`, `react-dom`, `zod`) and
dev dependencies (Vite, Vitest, TypeScript, Testing Library, Supertest, jsdom, coverage tools)
listed in [package.json](package.json).

### Step 3 — No separate activation step

Unlike a Python virtual environment, Node projects do not require an "activate" step; npm
scripts run against the local `node_modules` automatically.

---

## Environment Variables

| Variable | Required? | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | `3000` | TCP port the Express server listens on. Read in [server/src/index.ts](server/src/index.ts) via `Number(process.env.PORT ?? 3000)`. |
| `NODE_ENV` | No | unset (dev) | Set to `production` inside the Docker runtime stage ([Dockerfile](Dockerfile)); not explicitly branched on anywhere in the observed application code (Confirmed by search). |

No other environment variables, `.env` files, or secrets exist in the repository (Confirmed —
no `.env*` files found; a repo-wide search for `process.env` returned only the `PORT` usage
above). This matches the project's "no external provider, no persisted secrets" design
( [adr/ADR-DETERMINISTIC.md](adr/ADR-DETERMINISTIC.md) ).

---

## Running Locally

Per [README.md](README.md), run the API and the front-end in two terminals:

**Terminal 1 — API server** (listens on port 3000):

```pwsh
npm run dev:server
```

This runs `vite-node server/src/index.ts`, starting the Express app defined in
[server/src/http/app.ts](server/src/http/app.ts).

**Terminal 2 — Front-end dev server**:

```pwsh
npm run dev
```

This runs `vite`, which serves the React app and proxies `/api` and `/health` requests to
`http://localhost:3000` (Confirmed — [vite.config.ts](vite.config.ts)). Open the URL Vite
prints (typically `http://localhost:5173`).

### Production-style build

```pwsh
npm run build
```

Builds static front-end assets into `dist/` (Confirmed —
[vite.config.ts](vite.config.ts) `build.outDir: "dist"`). Note: as documented in
[AppArch.md](AppArch.md#architectural-risks), the Express server does not itself serve
`dist/` — verify how static assets are actually served in your target environment before
relying on this build output alone.

### Container build/run

```pwsh
docker build -t specpilot:latest .
docker run -p 3000:3000 specpilot:latest
```

(Confirmed — [Dockerfile](Dockerfile), [deploy/README.md](deploy/README.md).)

---

## Running Tests

```pwsh
npm test          # vitest run — single pass, no coverage
npm run test:ci   # vitest run --coverage, then scripts/coverage-report.mjs prints the line-coverage %
npm run gate       # alias for npm run test:ci
```

Test suite location: [tests/](tests) mirrors the source layout (`app/`, `build/`, `core/`,
`deploy/`, `docs/`, `e2e/`, `http/`, `shared/`, `web/`) — Confirmed by directory listing.
Config: [vitest.config.ts](vitest.config.ts) (Node environment, globals enabled, setup file
[tests/setup.ts](tests/setup.ts) which loads `@testing-library/jest-dom/vitest`).

To run a single test file or filter by name:

```pwsh
npx vitest run tests/http/generate.test.ts
npx vitest run -t "generate"
```

---

## Common Errors

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Error: Cannot find module` on `npm run dev:server` | `npm install` was not run, or `node_modules` is stale/corrupted | Run `npm install` again; delete `node_modules` and reinstall if needed |
| Browser shows blank page / network errors calling `/api/generate` | Only `npm run dev` was started, without `npm run dev:server` | Start both processes in separate terminals as documented above |
| `EADDRINUSE: address already in use :::3000` | Another process (or a previous unterminated server) is bound to port 3000 | Stop the other process, or set `PORT` to a free port: `$env:PORT=3001; npm run dev:server` and update the Vite proxy target if needed |
| `400 VALIDATION_FAILED` from `/api/generate` | Empty `productTitle`/`productDetails`, or no `selectedTypes` chosen | Ensure the request body satisfies `shared/src/validate.ts`'s rules (non-empty title/details, ≥1 type) |
| `500 GENERATION_FAILED` / `500 EXPORT_FAILED` | Unexpected exception during generation/export; the API intentionally returns no detail for 500s | Reproduce locally with `npm test` / targeted Vitest run against [tests/http/generate.test.ts](tests/http/generate.test.ts) or [tests/http/export.test.ts](tests/http/export.test.ts) to see the underlying error in the test output |
| TypeScript version mismatch / type errors on build | Wrong Node/TypeScript version, or `node_modules` out of sync with `package-lock.json` | Confirm `node --version` is 20+, run `npm ci` for a clean, lockfile-exact install |
| Docker container starts but `/health` never responds | Container built without `npm run build` having succeeded, or port not published | Rebuild image; confirm `docker run -p 3000:3000 ...` maps the port; check container logs |

No Python-version or virtual-environment errors are applicable to this project.

---

## Verification

1. **Health check** — confirms the server started:
   ```pwsh
   curl http://localhost:3000/health
   ```
   Expected: `{"status":"ok"}` (Confirmed — [server/src/http/app.ts](server/src/http/app.ts)).

2. **Smoke script** — the repository's own post-deploy check:
   ```pwsh
   sh deploy/smoke.sh http://localhost:3000
   ```
   (Requires a POSIX shell such as WSL/Git Bash on Windows, since it uses `sh` and `wget` —
   Confirmed — [deploy/smoke.sh](deploy/smoke.sh).)

3. **End-to-end manual check** — with both dev processes running, open the Vite URL, enter a
   Product Title and Product Details, select at least one document type, click Generate, and
   confirm the output segment(s) render text; then click Export Word/PDF and confirm a file
   downloads whose name starts with the sanitized product title (Confirmed behavior per
   [Flow.md](Flow.md)).

4. **Automated verification** — a green `npm test` run is the most reliable signal that both
   the API contract and generation logic behave as documented.

---

## Troubleshooting

- **Start from the tests**: because there is no external service to misconfigure (no DB, no
  API keys), almost all runtime issues are either (a) both dev processes not running
  simultaneously, (b) a port conflict, or (c) a stale `node_modules`/lockfile mismatch. Rule
  these out first.
- **Isolate front-end vs. back-end**: hit `http://localhost:3000/health` directly. If that
  fails, the problem is in the Express server startup — check the terminal running
  `npm run dev:server` for stack traces. If `/health` succeeds but the browser UI shows
  network errors, the problem is in the Vite proxy or the front-end dev server.
  ([vite.config.ts](vite.config.ts) proxy config assumes the API is on port 3000 — if `PORT`
  was overridden, update the proxy target too.)
- **Reproduce API errors directly** with `curl`/Postman against `/api/generate` and
  `/api/export` using the exact shapes in [shared/src/contract.ts](shared/src/contract.ts) to
  determine whether a failure is a validation issue (400) vs. an internal error (500).
- **Check test output for the failing area**: `tests/core/*` covers the generators,
  `tests/http/*` covers the Express routes, `tests/app/*` covers `genService`/`exportService`,
  `tests/web/*` covers React components, `tests/shared/*` covers contract/validate/naming,
  `tests/e2e/acceptance.test.ts` covers end-to-end acceptance criteria, and
  `tests/deploy/smoke.test.ts` covers the smoke script. Run the narrowest relevant file first.
- **Coverage gate failures** (`npm run test:ci` / `npm run gate`): read the printed
  `Coverage: NN%` line from [scripts/coverage-report.mjs](scripts/coverage-report.mjs) and
  inspect `coverage/coverage-summary.json` for which files/lines are uncovered.
- **Docker-specific issues**: since the server does not call `express.static` (see
  [AppArch.md](AppArch.md#architectural-risks)), do not expect the containerized deployment to
  serve the built UI at `/` — only `/health`, `/api/generate`, and `/api/export` are
  guaranteed to work out of the box. If you need the UI served from the same origin in
  production, this is a gap to close before relying on the container alone.
