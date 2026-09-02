# SpecPilot — Work Plan

## Overview

This plan implements SpecPilot from [Spec.md](Spec.md) and [design.md](design.md) as a set of
small, test-first pull requests. Stack: an npm workspaces monorepo (`shared`, `server`, `web`)
using TypeScript, Vite for the front-end, Express for the back-end, Vitest for tests, Supertest
for HTTP, and axe-core for accessibility. Branching: short-lived branches merged to trunk, each
PR green in CI before merge, feature work guarded so trunk stays shippable. Git worktrees are
recommended for the independent waves noted in Sequencing & Risks. Done means: the PR's tests
pass, lint and type checks pass, the touched requirements/components are covered, and the app
still builds and boots.

Work Scope: Product/system.
Plan Type: Implementation.
Implementation Readiness: Code-ready.

The system is small enough to implement directly rather than decompose into child specs; each
design component maps to one focused PR under the 300-LOC ceiling.

## Strategy

- Red/Green/Refactor TDD: every PR first adds failing tests (Red) at the stated level, then adds
  the minimal code to pass (Green), then refactors with tests green.
- PR size: each PR changes 300 LOC or fewer across production and test code, one focused concern.
- Always shippable: PRs merge in dependency order; no PR depends on a later PR. The monorepo
  scaffold and shared contract land first so downstream PRs compile against a stable boundary.
- Layer order: shared contract and pure logic first, then the generation core, then application
  services, then the HTTP surface, then the front-end, then end-to-end, deployment, and docs.
- Build artifact strategy: PR-FOUND-SCAFFOLD establishes the workspace build; PR-DEPLOY-CONTAINER
  packages the built assets and server into one container image with a smoke check.
- Deployment strategy: a container image plus static assets, validated by a health-route smoke
  check in staging; no live production deploy is performed.
- Documentation strategy: a README lands with the scaffold and is completed by PR-DOCS-USERGUIDE,
  which also validates the in-app help content.
- This plan implements code-ready work; it does not decompose into child artifacts.

## Milestones

- **MILE-FOUND-BASE** — Monorepo scaffold, shared contract, validation, and naming logic.
- **MILE-GEN-CORE** — Deterministic PRD, TRS, and UX generators plus the generation service.
- **MILE-API-SURFACE** — HTTP generate and export endpoints and the export service.
- **MILE-WEB-UI** — Dark theme, app shell, API client, input form, output view, and export UI.
- **MILE-RELEASE-SHIP** — End-to-end acceptance tests, container packaging, and documentation.

## Pull Requests / Child Work Items

- **PR-FOUND-SCAFFOLD** — Scaffold the `shared`, `server`, and `web` workspaces with TypeScript,
  Vitest, ESLint, Prettier, and root scripts.
  - Planned Touch Set: `package.json`, `tsconfig.base.json`, `.eslintrc.cjs`, `.prettierrc`,
    `shared/package.json`, `server/package.json`, `web/package.json`, `web/vite.config.ts`,
    `README.md`.
  - Build/Deploy Work: root `build`, `test`, and `lint` scripts and workspace manifests.
  - Documentation Work: README skeleton with setup and build instructions.
  - Test Levels: build/deploy check.
  - Red: a failing CI smoke test asserting `npm run build` and `npm test` succeed.
  - Green: add configs and scripts so build, test, and lint pass.
  - est LOC: 240. COMP built: none (foundation). Delivers: build tooling. Depends-on: none.
- **PR-SHARED-CONTRACT** — Implement the shared request/response schema and types.
  - Planned Touch Set: `shared/src/contract.ts`, `shared/src/index.ts`,
    `shared/test/contract.test.ts`.
  - Build/Deploy Work: None — no build change beyond the shared package output.
  - Documentation Work: contract usage note in `shared/README.md`.
  - Test Levels: unit, contract.
  - Red: failing unit tests that a valid request parses and an invalid request is rejected.
  - Green: define the Zod schema and TypeScript types for IFACE-CONTRACT.
  - est LOC: 180. COMP built: COMP-TYPES. Delivers: FR-GEN-TRIGGER, UC-GEN-RUN.
    Depends-on: PR-FOUND-SCAFFOLD.
- **PR-SHARED-VALIDATE** — Implement pure request validation.
  - Planned Touch Set: `shared/src/validate.ts`, `shared/test/validate.test.ts`.
  - Build/Deploy Work: None — pure logic only.
  - Documentation Work: None — covered by the shared README.
  - Test Levels: unit.
  - Red: failing tests for empty title, empty details, and no selected type via AT-INPUT-VALIDATE.
  - Green: implement `validate(request)` returning field errors for IFACE-VALIDATE.
  - est LOC: 150. COMP built: COMP-VALIDATE. Delivers: FR-INPUT-VALIDATE, UC-INPUT-ENTER,
    AT-INPUT-VALIDATE. Depends-on: PR-SHARED-CONTRACT.
- **PR-SHARED-NAMING** — Implement the title-prefixed filename builder.
  - Planned Touch Set: `shared/src/naming.ts`, `shared/test/naming.test.ts`.
  - Build/Deploy Work: None — pure logic only.
  - Documentation Work: None — covered by the shared README.
  - Test Levels: unit.
  - Red: failing tests that a title prefixes the filename and unsafe characters are sanitized.
  - Green: implement `prefixFilename(title, type, extension)` for IFACE-NAMING.
  - est LOC: 120. COMP built: COMP-NAMING. Delivers: FR-NAME-PREFIX, UC-EXPORT-WORDPDF.
    Depends-on: PR-SHARED-CONTRACT.
- **PR-CORE-PRDGEN** — Implement the deterministic PRD generator.
  - Planned Touch Set: `server/src/core/prdGen.ts`, `server/test/core/prdGen.test.ts`.
  - Build/Deploy Work: None — pure logic only.
  - Documentation Work: None — behavior documented in the design.
  - Test Levels: unit.
  - Red: a failing golden-output test asserting the nine PRD sections appear in order via
    AT-PRD-SECTIONS.
  - Green: implement `buildPrd(request)` for IFACE-PRDGEN.
  - est LOC: 220. COMP built: COMP-PRDGEN. Delivers: FR-PRD-SECTIONS, AT-PRD-SECTIONS, UC-GEN-RUN.
    Depends-on: PR-SHARED-CONTRACT.
- **PR-CORE-TRSGEN** — Implement the deterministic TRS generator.
  - Planned Touch Set: `server/src/core/trsGen.ts`, `server/test/core/trsGen.test.ts`.
  - Build/Deploy Work: None — pure logic only.
  - Documentation Work: None — behavior documented in the design.
  - Test Levels: unit.
  - Red: a failing golden-output test asserting the twelve TRS sections appear in order via
    AT-TRS-SECTIONS.
  - Green: implement `buildTrs(request)` for IFACE-TRSGEN.
  - est LOC: 240. COMP built: COMP-TRSGEN. Delivers: FR-TRS-SECTIONS, AT-TRS-SECTIONS.
    Depends-on: PR-SHARED-CONTRACT.
- **PR-CORE-UXGEN** — Implement the deterministic UX mockup generator.
  - Planned Touch Set: `server/src/core/uxGen.ts`, `server/test/core/uxGen.test.ts`.
  - Build/Deploy Work: None — pure logic only.
  - Documentation Work: None — behavior documented in the design.
  - Test Levels: unit.
  - Red: a failing test asserting a journeys segment and a UI-mockups segment via AT-UX-SEGMENTS.
  - Green: implement `buildUx(request)` for IFACE-UXGEN.
  - est LOC: 200. COMP built: COMP-UXGEN. Delivers: FR-UX-SEGMENTS, AT-UX-SEGMENTS.
    Depends-on: PR-SHARED-CONTRACT.
- **PR-APP-GENSERVICE** — Implement generation orchestration over the selected generators.
  - Planned Touch Set: `server/src/app/genService.ts`, `server/test/app/genService.test.ts`.
  - Build/Deploy Work: None — in-memory composition only.
  - Documentation Work: None — behavior documented in the design.
  - Test Levels: unit, quality/NFR.
  - Red: failing tests that only selected types are produced via AT-GEN-SELECTED and that
    generation timing is measured within budget via AT-PERF-GEN.
  - Green: implement `generate(request)` for IFACE-GENSVC with no retained state.
  - est LOC: 190. COMP built: COMP-GENSERVICE. Delivers: FR-GEN-TRIGGER, FR-REGEN-REPLACE,
    NFR-PERF-GENLATENCY, NFR-DATA-NOPERSIST, AT-GEN-SELECTED, AT-PERF-GEN, UC-GEN-RUN.
    Depends-on: PR-CORE-PRDGEN, PR-CORE-TRSGEN, PR-CORE-UXGEN, PR-SHARED-VALIDATE.
- **PR-API-HTTP** — Implement the generate endpoint, error envelope, security headers, and health route.
  - Planned Touch Set: `server/src/http/app.ts`, `server/src/http/generateRoute.ts`,
    `server/src/http/errors.ts`, `server/src/index.ts`, `server/test/http/generate.test.ts`.
  - Build/Deploy Work: a `/health` route used by the later smoke check.
  - Documentation Work: endpoint notes in `server/README.md`.
  - Test Levels: integration, contract, quality/NFR.
  - Red: failing Supertest cases for a valid generate call, a 400 error envelope on invalid input,
    security headers for NFR-SEC-TRANSPORT, and a no-store assertion for NFR-DATA-NOPERSIST.
  - Green: implement Express wiring for IFACE-GENAPI and helmet-based headers.
  - est LOC: 260. COMP built: COMP-HTTPAPI. Delivers: FR-GEN-TRIGGER, NFR-SEC-TRANSPORT,
    NFR-SCAL-CONCURRENCY, NFR-REL-RECOVERY, NFR-DATA-NOPERSIST, UC-GEN-RUN.
    Depends-on: PR-APP-GENSERVICE.
- **PR-APP-EXPORTSVC** — Implement Word, PDF, and mockup file builders.
  - Planned Touch Set: `server/src/app/exportService.ts`, `server/test/app/exportService.test.ts`.
  - Build/Deploy Work: add `docx` and `pdfkit` dependencies to `server/package.json`.
  - Documentation Work: None — covered by the server README.
  - Test Levels: unit.
  - Red: failing tests that Word, PDF, and mockup buffers are produced with prefixed names.
  - Green: implement `buildWord`, `buildPdf`, and `buildMockup` for IFACE-EXPORTSVC.
  - est LOC: 260. COMP built: COMP-EXPORTSVC. Delivers: FR-EXPORT-WORD, FR-EXPORT-PDF,
    FR-EXPORT-UXDOWNLOAD, UC-EXPORT-WORDPDF, UC-EXPORT-DOWNLOADUX.
    Depends-on: PR-SHARED-NAMING, PR-SHARED-CONTRACT.
- **PR-API-EXPORT** — Add the export endpoint that streams a built file as a download.
  - Planned Touch Set: `server/src/http/exportRoute.ts`, `server/src/http/app.ts`,
    `server/test/http/export.test.ts`.
  - Build/Deploy Work: None — route wiring only.
  - Documentation Work: export endpoint notes in `server/README.md`.
  - Test Levels: integration, contract.
  - Red: failing Supertest cases that the endpoint returns a binary body and a
    Content-Disposition filename for IFACE-EXPORTAPI.
  - Green: implement the export route delegating to the export service.
  - est LOC: 150. COMP built: COMP-HTTPAPI. Delivers: FR-EXPORT-WORD, FR-EXPORT-PDF,
    FR-EXPORT-UXDOWNLOAD. Depends-on: PR-APP-EXPORTSVC, PR-API-HTTP.
- **PR-WEB-THEME** — Implement the dark theme tokens, focus styling, and provider.
  - Planned Touch Set: `web/src/theme/tokens.css`, `web/src/theme/ThemeProvider.tsx`,
    `web/test/theme.test.tsx`.
  - Build/Deploy Work: None — front-end assets only.
  - Documentation Work: token usage note in `web/README.md`.
  - Test Levels: UI/accessibility.
  - Red: a failing axe-core test that the dark theme renders by default with visible focus and
    passes contrast via AT-THEME-USE.
  - Green: implement tokens and the provider for IFACE-THEME.
  - est LOC: 200. COMP built: COMP-THEME. Delivers: FR-THEME-DARKDEFAULT, FR-THEME-KEYBOARD,
    NFR-USAB-ACCESS, AT-THEME-USE, UC-THEME-USE. Depends-on: PR-FOUND-SCAFFOLD.
- **PR-WEB-APPSHELL** — Implement the root layout, tab container, and in-app help panel.
  - Planned Touch Set: `web/src/app/AppShell.tsx`, `web/src/app/HelpPanel.tsx`,
    `web/test/appShell.test.tsx`.
  - Build/Deploy Work: None — front-end assets only.
  - Documentation Work: in-app help copy for the three document types and export actions.
  - Test Levels: component, UI/accessibility.
  - Red: failing tests that the shell renders on supported browsers via NFR-PORT-BROWSER and shows
    help content via NFR-DOC-USERHELP.
  - Green: implement the layout, tab container, and help panel.
  - est LOC: 180. COMP built: COMP-APPSHELL. Delivers: NFR-PORT-BROWSER, NFR-DOC-USERHELP,
    UC-VIEW-SWITCH. Depends-on: PR-WEB-THEME.
- **PR-WEB-APICLIENT** — Implement the browser API client and error-envelope mapping.
  - Planned Touch Set: `web/src/api/client.ts`, `web/test/api/client.test.ts`.
  - Build/Deploy Work: None — front-end assets only.
  - Documentation Work: None — covered by the web README.
  - Test Levels: unit.
  - Red: failing tests with a mocked network that success and error envelopes map correctly.
  - Green: implement `generate` and `exportDocument` for IFACE-APICLIENT.
  - est LOC: 180. COMP built: COMP-APICLIENT. Delivers: FR-GEN-TRIGGER, UC-GEN-RUN.
    Depends-on: PR-API-HTTP, PR-API-EXPORT.
- **PR-WEB-INPUTFORM** — Implement the input form with validation feedback and regenerate.
  - Planned Touch Set: `web/src/features/input/InputForm.tsx`,
    `web/test/features/inputForm.test.tsx`.
  - Build/Deploy Work: None — front-end assets only.
  - Documentation Work: None — covered by the in-app help.
  - Test Levels: component, UI/accessibility.
  - Red: failing tests for field entry and selection via AT-INPUT-ENTER and blocked generation via
    AT-INPUT-VALIDATE.
  - Green: implement the form, wiring validation and the API client.
  - est LOC: 260. COMP built: COMP-INPUTFORM. Delivers: FR-INPUT-TITLE, FR-INPUT-DETAILS,
    FR-INPUT-SELECT, FR-INPUT-VALIDATE, FR-REGEN-EDITINPUT, UC-INPUT-ENTER, AT-INPUT-ENTER,
    AT-INPUT-VALIDATE. Depends-on: PR-SHARED-VALIDATE, PR-WEB-APICLIENT, PR-WEB-APPSHELL.
- **PR-WEB-OUTPUTVIEW** — Implement the segmented output view with inline editing and regenerate replace.
  - Planned Touch Set: `web/src/features/output/OutputView.tsx`,
    `web/test/features/outputView.test.tsx`.
  - Build/Deploy Work: None — front-end assets only.
  - Documentation Work: None — covered by the in-app help.
  - Test Levels: component.
  - Red: failing tests for segment switching via AT-VIEW-SWITCH, edit retention via AT-EDIT-TEXT,
    and regenerate replacement via AT-REGEN-UPDATE.
  - Green: implement the tabbed view, edit state, and per-type replacement.
  - est LOC: 280. COMP built: COMP-OUTPUTVIEW. Delivers: FR-VIEW-SEGMENTED, FR-VIEW-ONLYSELECTED,
    FR-EDIT-UPDATE, FR-EDIT-PERSISTVIEW, FR-REGEN-REPLACE, UC-VIEW-SWITCH, UC-EDIT-TEXT,
    UC-REGEN-UPDATE, AT-VIEW-SWITCH, AT-EDIT-TEXT, AT-REGEN-UPDATE.
    Depends-on: PR-WEB-APPSHELL, PR-SHARED-CONTRACT.
- **PR-WEB-EXPORTUI** — Implement the export and download controls.
  - Planned Touch Set: `web/src/features/export/ExportControls.tsx`,
    `web/test/features/exportControls.test.tsx`.
  - Build/Deploy Work: None — front-end assets only.
  - Documentation Work: None — covered by the in-app help.
  - Test Levels: component.
  - Red: failing tests that Word and PDF export trigger a prefixed download via AT-EXPORT-WORDPDF and
    that mockups download via AT-EXPORT-UX.
  - Green: implement the controls calling the API client and naming helper.
  - est LOC: 220. COMP built: COMP-EXPORTUI. Delivers: FR-EXPORT-WORD, FR-EXPORT-PDF,
    FR-EXPORT-UXDOWNLOAD, UC-EXPORT-WORDPDF, UC-EXPORT-DOWNLOADUX, AT-EXPORT-WORDPDF, AT-EXPORT-UX.
    Depends-on: PR-WEB-APICLIENT, PR-SHARED-NAMING, PR-WEB-OUTPUTVIEW.
- **PR-E2E-ACCEPTANCE** — Add end-to-end acceptance tests over the running app.
  - Planned Touch Set: `e2e/generate.spec.ts`, `e2e/export.spec.ts`, `e2e/playwright.config.ts`.
  - Build/Deploy Work: an end-to-end test job in the build scripts.
  - Documentation Work: None — test-only.
  - Test Levels: acceptance/e2e.
  - Red: failing end-to-end specs for AT-GEN-SELECTED, AT-PRD-SECTIONS, AT-TRS-SECTIONS,
    AT-UX-SEGMENTS, and AT-PERF-GEN across the full stack.
  - Green: wire the specs against a locally served build until they pass.
  - est LOC: 260. COMP built: none (verifies COMP-HTTPAPI and web components end to end).
    Delivers: AT-GEN-SELECTED, AT-PRD-SECTIONS, AT-TRS-SECTIONS, AT-UX-SEGMENTS, AT-PERF-GEN.
    Depends-on: PR-WEB-INPUTFORM, PR-WEB-OUTPUTVIEW, PR-WEB-EXPORTUI.
- **PR-DEPLOY-CONTAINER** — Package the app into a container image with a smoke check.
  - Planned Touch Set: `Dockerfile`, `.dockerignore`, `deploy/smoke.sh`, `deploy/README.md`.
  - Build/Deploy Work: multi-stage image building static assets and the server, plus a smoke check
    hitting `/health` and a rollback note.
  - Documentation Work: deployment runbook in `deploy/README.md`.
  - Test Levels: build/deploy.
  - Red: a failing smoke check that the built container serves `/health` within budget via
    NFR-DEPLOY-SMOKE.
  - Green: add the Dockerfile and smoke script so the check passes in staging.
  - est LOC: 170. COMP built: none (packages COMP-HTTPAPI and the web build).
    Delivers: NFR-DEPLOY-SMOKE. Depends-on: PR-API-EXPORT, PR-WEB-EXPORTUI.
- **PR-DOCS-USERGUIDE** — Complete the README and user guide and validate in-app help.
  - Planned Touch Set: `README.md`, `docs/user-guide.md`, `web/test/help.content.test.tsx`.
  - Build/Deploy Work: a documentation link check in the build scripts.
  - Documentation Work: user guide covering input, generation, editing, and export, plus help
    content coverage for NFR-DOC-USERHELP.
  - Test Levels: docs.
  - Red: a failing check that help content covers the three document types and export actions.
  - Green: write the guide and help content until the check passes.
  - est LOC: 190. COMP built: none (documents COMP-APPSHELL help).
    Delivers: NFR-DOC-USERHELP. Depends-on: PR-WEB-APPSHELL, PR-WEB-EXPORTUI.

## Coverage Map

Functional requirements to PRs:

| FR | PR |
| --- | --- |
| FR-INPUT-TITLE | PR-WEB-INPUTFORM |
| FR-INPUT-DETAILS | PR-WEB-INPUTFORM |
| FR-INPUT-SELECT | PR-WEB-INPUTFORM |
| FR-INPUT-VALIDATE | PR-SHARED-VALIDATE, PR-WEB-INPUTFORM |
| FR-GEN-TRIGGER | PR-SHARED-CONTRACT, PR-APP-GENSERVICE, PR-API-HTTP, PR-WEB-APICLIENT |
| FR-PRD-SECTIONS | PR-CORE-PRDGEN |
| FR-TRS-SECTIONS | PR-CORE-TRSGEN |
| FR-UX-SEGMENTS | PR-CORE-UXGEN |
| FR-VIEW-SEGMENTED | PR-WEB-OUTPUTVIEW |
| FR-VIEW-ONLYSELECTED | PR-WEB-OUTPUTVIEW |
| FR-EDIT-UPDATE | PR-WEB-OUTPUTVIEW |
| FR-EDIT-PERSISTVIEW | PR-WEB-OUTPUTVIEW |
| FR-EXPORT-WORD | PR-APP-EXPORTSVC, PR-API-EXPORT, PR-WEB-EXPORTUI |
| FR-EXPORT-PDF | PR-APP-EXPORTSVC, PR-API-EXPORT, PR-WEB-EXPORTUI |
| FR-EXPORT-UXDOWNLOAD | PR-APP-EXPORTSVC, PR-API-EXPORT, PR-WEB-EXPORTUI |
| FR-NAME-PREFIX | PR-SHARED-NAMING |
| FR-REGEN-EDITINPUT | PR-WEB-INPUTFORM |
| FR-REGEN-REPLACE | PR-APP-GENSERVICE, PR-WEB-OUTPUTVIEW |
| FR-THEME-DARKDEFAULT | PR-WEB-THEME |
| FR-THEME-KEYBOARD | PR-WEB-THEME |

Use cases to PRs:

| UC | PR |
| --- | --- |
| UC-INPUT-ENTER | PR-SHARED-VALIDATE, PR-WEB-INPUTFORM |
| UC-GEN-RUN | PR-APP-GENSERVICE, PR-API-HTTP, PR-WEB-APICLIENT |
| UC-VIEW-SWITCH | PR-WEB-APPSHELL, PR-WEB-OUTPUTVIEW |
| UC-EDIT-TEXT | PR-WEB-OUTPUTVIEW |
| UC-EXPORT-WORDPDF | PR-SHARED-NAMING, PR-APP-EXPORTSVC, PR-WEB-EXPORTUI |
| UC-EXPORT-DOWNLOADUX | PR-APP-EXPORTSVC, PR-WEB-EXPORTUI |
| UC-REGEN-UPDATE | PR-WEB-OUTPUTVIEW |
| UC-THEME-USE | PR-WEB-THEME |

Non-functional requirements to PRs:

| NFR | PR |
| --- | --- |
| NFR-PERF-GENLATENCY | PR-APP-GENSERVICE |
| NFR-REL-RECOVERY | PR-API-HTTP |
| NFR-SCAL-CONCURRENCY | PR-API-HTTP |
| NFR-SEC-TRANSPORT | PR-API-HTTP |
| NFR-USAB-ACCESS | PR-WEB-THEME |
| NFR-PORT-BROWSER | PR-WEB-APPSHELL |
| NFR-DATA-NOPERSIST | PR-APP-GENSERVICE, PR-API-HTTP |
| NFR-DOC-USERHELP | PR-WEB-APPSHELL, PR-DOCS-USERGUIDE |
| NFR-DEPLOY-SMOKE | PR-DEPLOY-CONTAINER |

Acceptance tests to PRs:

| AT | PR |
| --- | --- |
| AT-INPUT-ENTER | PR-WEB-INPUTFORM |
| AT-INPUT-VALIDATE | PR-SHARED-VALIDATE, PR-WEB-INPUTFORM |
| AT-GEN-SELECTED | PR-APP-GENSERVICE, PR-E2E-ACCEPTANCE |
| AT-PRD-SECTIONS | PR-CORE-PRDGEN, PR-E2E-ACCEPTANCE |
| AT-TRS-SECTIONS | PR-CORE-TRSGEN, PR-E2E-ACCEPTANCE |
| AT-UX-SEGMENTS | PR-CORE-UXGEN, PR-E2E-ACCEPTANCE |
| AT-VIEW-SWITCH | PR-WEB-OUTPUTVIEW |
| AT-EDIT-TEXT | PR-WEB-OUTPUTVIEW |
| AT-EXPORT-WORDPDF | PR-WEB-EXPORTUI |
| AT-EXPORT-UX | PR-WEB-EXPORTUI |
| AT-REGEN-UPDATE | PR-WEB-OUTPUTVIEW |
| AT-THEME-USE | PR-WEB-THEME |
| AT-PERF-GEN | PR-APP-GENSERVICE, PR-E2E-ACCEPTANCE |

Design components to PRs:

| COMP | PR |
| --- | --- |
| COMP-TYPES | PR-SHARED-CONTRACT |
| COMP-VALIDATE | PR-SHARED-VALIDATE |
| COMP-NAMING | PR-SHARED-NAMING |
| COMP-PRDGEN | PR-CORE-PRDGEN |
| COMP-TRSGEN | PR-CORE-TRSGEN |
| COMP-UXGEN | PR-CORE-UXGEN |
| COMP-GENSERVICE | PR-APP-GENSERVICE |
| COMP-HTTPAPI | PR-API-HTTP, PR-API-EXPORT |
| COMP-EXPORTSVC | PR-APP-EXPORTSVC |
| COMP-THEME | PR-WEB-THEME |
| COMP-APPSHELL | PR-WEB-APPSHELL |
| COMP-APICLIENT | PR-WEB-APICLIENT |
| COMP-INPUTFORM | PR-WEB-INPUTFORM |
| COMP-OUTPUTVIEW | PR-WEB-OUTPUTVIEW |
| COMP-EXPORTUI | PR-WEB-EXPORTUI |

## Sequencing & Risks

Merge order follows the PR list top to bottom. Parallel waves:

- Wave 1: PR-FOUND-SCAFFOLD.
- Wave 2: PR-SHARED-CONTRACT.
- Wave 3 (parallel): PR-SHARED-VALIDATE, PR-SHARED-NAMING, PR-CORE-PRDGEN, PR-CORE-TRSGEN,
  PR-CORE-UXGEN, PR-WEB-THEME.
- Wave 4 (parallel): PR-APP-GENSERVICE, PR-APP-EXPORTSVC, PR-WEB-APPSHELL.
- Wave 5 (parallel): PR-API-HTTP, PR-WEB-OUTPUTVIEW.
- Wave 6 (parallel): PR-API-EXPORT, PR-WEB-APICLIENT.
- Wave 7 (parallel): PR-WEB-INPUTFORM, PR-WEB-EXPORTUI.
- Wave 8 (parallel): PR-E2E-ACCEPTANCE, PR-DEPLOY-CONTAINER, PR-DOCS-USERGUIDE.

Critical path: PR-FOUND-SCAFFOLD, PR-SHARED-CONTRACT, PR-CORE-PRDGEN, PR-APP-GENSERVICE,
PR-API-HTTP, PR-WEB-APICLIENT, PR-WEB-INPUTFORM, PR-E2E-ACCEPTANCE, PR-DEPLOY-CONTAINER.

Worktree guidance: Wave 3 through Wave 8 hold independent PRs that touch separate files, so each
is well suited to a separate Git worktree per branch. The `shared` package is the main shared
surface; land PR-SHARED-CONTRACT before opening wave 3 to avoid contract churn. Build must precede
deployment: PR-FOUND-SCAFFOLD establishes the build before PR-DEPLOY-CONTAINER packages it.
Documentation lands with or after the behavior it describes: PR-DOCS-USERGUIDE follows the UI PRs.

Risks: export-library output fidelity (RISK-EXPORTFIDELITY) is contained by golden-buffer tests in
PR-APP-EXPORTSVC; accessibility regressions (RISK-A11Y) are caught by axe-core in PR-WEB-THEME;
scope pressure toward saved drafts (RISK-SCOPECREEP) is held by the stateless decision. Rollback
per PR is a revert of the single focused branch because each PR is independently shippable.
Likely merge-conflict points are `server/src/http/app.ts` between PR-API-HTTP and PR-API-EXPORT and
`README.md` between PR-FOUND-SCAFFOLD and PR-DOCS-USERGUIDE; sequence those pairs rather than
running them in the same wave.
