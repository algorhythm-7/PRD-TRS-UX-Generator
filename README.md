# SpecPilot — AI-Powered Specification Engine

**Generate professional PRDs, TRSs, and UX specifications from a product description in seconds—with human-in-the-loop feedback, intelligent fallback resilience, and enterprise compliance controls.**

[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Vite 7](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)](https://vitejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org)
[![Google Gemini API](https://img.shields.io/badge/Google%20Gemini-Integrated-4285F4?logo=google)](https://ai.google.dev)
[![Vitest](https://img.shields.io/badge/Vitest-3.0-6E9F18?logo=vitest)](https://vitest.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 💡 What Makes This Stand Out?

### Advanced AI Engineering
- **Structured Prompt Engineering** — 100+ lines of carefully tuned LLM guidance across 5 document types (PRD, TRS, UX)
- **Deterministic JSON Schema Validation** — Guarantees structured output from Gemini even under creative freedom; falls back to deterministic generators if LLM unavailable
- **Multi-Format Instruction Layers** — Per-template guidance (Volere, EARS, C4, PR/FAQ, Shape Up, etc.) automatically adjusts prompt structure without code duplication

### Production Resilience & Graceful Degradation
- **Dual-Path Generation** — LLM-first with transparent fallback to deterministic generators when API is unavailable
- **Per-DocType Isolation** — One document type's LLM failure never blocks parallel generation of other types
- **Offline-Capable Fallback** — Pure JavaScript generators produce valid, structured markdown with zero external calls
- **Session Continuity** — All work preserved across service interruptions; users never see a blank screen

### Human-in-the-Loop AI Feedback Loop
- **Section-Level Granularity** — 👍/👎 controls for individual sections, not just blanket "regenerate"
- **Intent Preservation** — Maintains your direct edits while incorporating targeted regeneration requests
- **Free-Text Contextual Feedback** — Comments are passed to the AI alongside structural markup for nuanced improvements
- **Iterative Refinement** — Edit → mark → comment → regenerate cycle improves output without starting over

### Intelligent Session Memory
- **Recency-Weighted Preference Learning** — User choices decay over 20 sessions with 0.9 decay factor; recent decisions influence future defaults 2.5× more than older ones
- **Per-Document-Type Profiles** — Each doc type learns independent preferences (template, mode, depth, decomposition, etc.)
- **Zero External Persistence** — All learning stored in `localStorage`; no backend database, no privacy concerns
- **Graceful Degradation** — Memory transparently degrades if localStorage is unavailable; app remains fully functional

### Enterprise Compliance & Traceability
- **Requirement ID Generation** — Automatic short IDs (`PRD-001`, `TRS-014`, etc.) for every requirement
- **Cross-Document Traceability** — CRS → TRS mapping shows which TRS requirements fulfill PRD commitments
- **Verification References** — Test cases cite requirement IDs for audit trail & compliance reviews
- **Standards-Based Framing** — ASPICE and ISO 26262 checkboxes guide LLM language toward formal compliance contexts
- **Stability Across Regenerations** — Best-effort ID reuse when requirements are recognized as unchanged

### Multimodal Reference Grounding
- **Multi-Format Document Upload** — `.txt`, `.md`, `.docx`, `.pdf` (3 reference docs + 1 style example per session)
- **Automatic Text Extraction** — Gemini's multimodal capabilities extract content from PDFs; Word/Markdown parsed natively
- **Style Matching** — Upload a previous well-written doc; AI matches its tone and detail level without copying content
- **Grounded Factuality** — Reference docs kept as context only; AI explicitly instructed to prioritize your input over invented details

---

## 🛠 Tech Stack & Engineering Skills

**Frontend**
- **React 19** — Modern hooks, component composition, state orchestration
- **Vite 7** — Sub-millisecond HMR, optimized dev server, TypeScript compilation
- **TypeScript 5.8** — Strict type safety; zero `any` types accepted

**Backend & LLM Integration**
- **Node.js 18+** — Event-driven server runtime
- **Express 4.21** — HTTP framework, middleware chain, route handling
- **Google Gemini API** (`@google/genai` v2.21) — Latest LLM SDK with structured output support

**Document Processing**
- **docx 8.5** — Word (`.docx`) generation with professional styling
- **marked 18** — Markdown → HTML with sanitization via DOMPurify
- **mammoth 1.12** — Docx parsing for custom template ingestion

**Testing & Quality**
- **Vitest 3.0** — Component tests (jsdom), server logic tests (node environment)
- **Testing Library** — React component interaction testing
- **ESLint 9.29** — Code quality enforcement
- **Prettier 3.5** — Code formatting consistency

**DevOps & Deployment**
- **Docker** — Single-stage containerization (production server only)
- **Helm** — Kubernetes package management for cloud deployment

### Key Engineering Patterns Demonstrated
- **Type-Safe Contracts** — `contract.ts` as single source of truth; frontend/backend enums never drift
- **State Machine Orchestration** — `App.tsx` manages input → gap-analysis → profile → generation → output → export flow
- **REST API Gateway Pattern** — Express server as typed LLM abstraction layer; no external microservices
- **Error Boundary Recovery** — Try-catch per document type; failures are isolated and graceful
- **Browser Storage Optimization** — Capped at 20 sessions with FIFO eviction; sub-50MB footprint

---

## ✨ Core Features & AI Capabilities

### 1. Multi-Document & Multi-Template Generation

Generate three document types from a single product description. Each type supports multiple industry-recognized formats:

**PRD (Product Requirements Document)**
- **Standard** — Traditional business-facing spec with problem, solution, requirements, personas, exclusions, success criteria
- **Volere** — Adds measurable "Fit Criteria" to every requirement; formal stakeholder & constraints structure
- **PR/FAQ** — Amazon-style "Working Backwards" press release + FAQ; customer-centric framing
- **Shape Up** — Fixed-timespan pitch format for scoping conversations

**TRS (Technical Requirements Specification)**
- **Standard** — Architecture, non-functional requirements, data, integrations, test/validation approach
- **EARS** — Every requirement phrased in one of six precise, testable sentence patterns (exception, multiple condition, etc.)
- **Formal SRS** — IEEE 1233 style; official-standard structure for regulated contexts
- **C4 Model** — Four zoom levels: system context, containers, components, dynamic scenarios; architecture-focused

**UX Specification**
- **Standard** — User journeys for personas + text-based wireframe mockups
- **Service Blueprint** — Splits actions into customer-visible actions vs. backend processes; service-design mindset
- **Jobs-to-Be-Done** — Frames UI around underlying motivation; strategic UX discovery
- **Atomic Design** — Component-to-page hierarchy; designed for teams with component libraries

### 2. Human-in-the-Loop Feedback & Targeted Regeneration

Edit any section and refine output without starting over:
- **Direct Editing** — Click into the Edit pane; changes appear live in Preview
- **Thumbs-Up/Down Section Control** — Mark sections to keep (👍) or rewrite (👎)
- **Regenerate with Feedback** — Your edits + comments + marks are sent back to the AI with instructions to preserve intent while improving marked sections
- **Smart Preservation** — AI respects your direct edits while interpreting thumbs-down marks as signals for deeper rewrites

### 3. Context & Multimodal Grounding

Provide real-world context to ground output in facts:
- **Reference Documents** — Upload up to 3 background docs (`.txt`, `.md`, `.docx`, `.pdf`): competitor research, existing specs, customer feedback
- **Style Example** — Upload one previously generated document; AI matches its tone and detail level
- **Automatic Extraction** — PDF text extracted via Gemini multimodal; Word/Markdown parsed natively; short preview shown post-upload for verification
- **Context-Only Instruction** — AI explicitly told to treat references as background, not as more authoritative than your product description

### 4. Deterministic Offline Fallback Architecture

Always produces output, even when Gemini is unavailable:
- **Three Pure-Function Generators** — `prdGen()`, `trsGen()`, `uxGen()` produce valid markdown with zero LLM calls
- **Per-DocType Isolation** — One doc type's LLM failure never blocks others' parallel generation
- **Graceful Degradation** — Clear banner explains when fallback is active; users see valid output, not blank screens
- **Transparent Source Tracking** — `GeneratedDocument.source` field (`"llm"` | `"fallback"`) marks origin for user visibility

### 5. Advanced Generation Profile Controls

Fine-tune output for your exact use case:

**Requirement Depth**
- High Level — Brief, capability-focused
- Standard Engineering — Today's normal detail level
- Detailed Engineering — Adds brief rationale and edge cases per requirement
- Compliance Grade — Rationale, edge-case handling, verification note per requirement

**Requirement Decomposition**
- Feature — Whole user-facing capabilities
- Functional Requirement — Today's normal granularity
- Sub-System — Grouped by named subsystem
- Component — Individual components
- Signal/Interface — Lowest granularity for implementation-ready detail

**Generation Mode** (Per-DocType "Lens")
- **PRD**: Customer Value, Product Management (default), Engineering Handoff, Executive Summary
- **TRS**: Strict TRS (default), Functional Decomposition, Implementation-Oriented, Verification-Oriented
- **UX**: User Journey (default), Wireframe Generation, Interaction Design, Accessibility Focus, Research & Discovery

**Assumption Strategy**
- Strict — No inventions; missing info becomes explicit Open Issues
- Balanced (default) — Today's normal behavior
- Exploratory — Proactively proposes plausible answers; favors forward progress

**Innovation Assistance** (5 Levels)
- Disabled (default) — Strictly grounded in stated/implied facts
- Suggest Missing — Proposes clearly-labeled missing requirements
- Challenge Assumptions — Questions and proposes alternatives
- Explore Alternatives — Suggests 1+ alternative approaches (all labeled)
- Maximum Ideation — Freely proposes novel ideas (all clearly labeled as ideation)

**Compliance Framing**
- ASPICE checkbox — Guides LLM language toward ASPICE standards
- ISO 26262 checkbox — Flags safety-relevant requirements; formal process context

### 6. Traceability & Requirement Mapping

Enable document-level traceability for regulated or formally reviewed work:
- **Generate Requirement IDs** — Short IDs assigned to every requirement (e.g., `CRS-PRD-001`, `TRS-014`)
- **CRS → TRS Mapping** — TRS requirements state which PRD requirement they fulfill (e.g., "fulfills CRS-PRD-003")
- **Verification References** — Test and Validation section cites requirement IDs for audit trails

### 7. Multi-Format Export

Export finished documents in three formats from identical Markdown source:
- **Word (`.docx`)** — Professional styling, office-ready for distribution
- **PDF** — Print-friendly, client-shareable format
- **HTML** — Web-shareable mockup (UX documents); preserves formatting and structure

### 8. Session History & Learned Preferences

Every generation leaves a record:
- **Per-Session Records** — Date, title, selected template, mode, depth, decomposition, feedback counts (section edits, thumbs-down marks)
- **Recency-Weighted Learning** — Recent choices decay by 0.9 factor; most recent session counts 2.5× more than sessions 10 generations old
- **Conflict Detection** — Low-confidence votes and near-ties flagged so defaults remain stable
- **Privacy First** — All learning local to browser; never sent to backend

---

## 🏗 System Architecture & Key Technical Decisions

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ User Input                                                       │
│ (Product Title, Details, Document Types, Guided Questions)      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Gap Analysis (LLM)    │ ◄─── Identifies missing info
        │  (Optional)            │      Returns up to 5 clarifications
        └────────┬───────────────┘
                 │
        (User answers or skips)
                 │
                 ▼
        ┌────────────────────────────────────────┐
        │ User Provides Clarifications (opt.)    │
        │ & Uploads Reference Docs (opt.)        │
        └────────┬───────────────────────────────┘
                 │
                 ▼
        ┌─────────────────────────────────────────────┐
        │ Generation Profile Screen                   │
        │ (Template, Mode, Depth, Decomposition, etc) │
        └────────┬────────────────────────────────────┘
                 │
                 ▼
        ┌──────────────────────────────────────────────────┐
        │ Parallel Multi-DocType Generation                │
        │                                                  │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
        │  │ PRD Gen  │  │ TRS Gen  │  │ UX Gen   │      │
        │  │ (LLM)    │  │ (LLM)    │  │ (LLM)    │      │
        │  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
        │       │              │              │            │
        │       ▼              ▼              ▼            │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
        │  │ Fallback │  │ Fallback │  │ Fallback │      │
        │  │ (if LLM  │  │ (if LLM  │  │ (if LLM  │      │
        │  │ fails)   │  │ fails)   │  │ fails)   │      │
        │  └──────────┘  └──────────┘  └──────────┘      │
        └──────────────────┬──────────────────────────────┘
                           │
                           ▼
        ┌────────────────────────────────────────┐
        │ Output View (Tabs)                     │
        │ - Edit pane (Markdown)                 │
        │ - Preview pane (Formatted)             │
        │ - Regenerate with Feedback Controls    │
        │ - Export (Word/PDF/HTML)               │
        └────────┬───────────────────────────────┘
                 │
                 ▼
        ┌────────────────────────────────────────┐
        │ Session Memory                         │
        │ (Record choices + feedback counts;     │
        │  update recency-weighted defaults)     │
        └────────────────────────────────────────┘
```

### Key Architectural Decisions

**1. Type-Safe Contracts Over Interfaces**
- Single source of truth: `app/src/generation/contract.ts` defines all enums, doc types, formats, modes, decomposition levels
- No runtime type mismatches between frontend/server; compile-time safety across the boundary
- Adding a new format or mode requires one change, not three (frontend, server, tests)

**2. Parallel Document Generation**
- Each document type (PRD, TRS, UX) generated independently and concurrently
- One type's LLM failure doesn't block others; failures are isolated per DocType
- Frontend receives up to 3 results; missing ones already have fallback content

**3. Dual-Instance LLM Gateway (Intentional Duplication)**
- Production: `server.mjs` (Express server); Docker copies only this file to container
- Development: `vite.config.ts` (Vite LLM dev plugin) — same logic, near-verbatim
- Why duplicate? Server can't `import` from anywhere in dev; must be self-contained for Docker
- Mitigated by: Extensive tests verify prompt behavior; CLAUDE.md documents the constraint; both files share identical structure and guidance tables

**4. Deterministic Fallback Generators**
- Three pure functions: `prdGen()`, `trsGen()`, `uxGen()` produce valid markdown with zero external calls
- No state mutations; no API calls; always return a valid document
- Fallback doesn't use Generation Profile settings (complexity vs. reliability tradeoff)
- Guarantees app never shows a blank screen

**5. Browser-Local Session Memory**
- User preferences stored in `localStorage`, never sent to backend
- Capped at 20 sessions with FIFO eviction; ~5–10KB per session
- Gracefully degrades if localStorage unavailable; app remains fully functional
- Recency-weighted voting: decay=0.9 makes recent choices 2.5× more influential than older ones

**6. Markdown as Interchange Format**
- All documents generated as Markdown internally
- Reconstruction from LLM's JSON: section names sourced from `sectionNamesFor()` template registry
- Export pipeline: Markdown → `marked` → HTML (or via `docx` library → Word, or WKHTMLTOPDF → PDF)
- Keeps generation layer agnostic to output format

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18 or later
- **npm** or **yarn**
- **Google Gemini API key** (free tier available at [aistudio.google.com/apikey](https://aistudio.google.com/apikey))

### Installation & Setup

```bash
cd app
npm install
```

Create `app/.env` with your Gemini API key:
```bash
GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-2.0-flash
```

### Run Commands

**Development (Vite dev server + hot reload)**
```bash
npm run dev
# Opens http://localhost:3001
```

**Production Build**
```bash
npm run build       # TypeScript + Vite bundle → dist/
npm start           # Node server serving dist/ on port 3001
```

**Testing & Quality Checks**
```bash
npm test              # Run Vitest suite once
npm run test:watch   # Watch mode (re-run on file change)
npm run lint         # ESLint checks
npm run format       # Prettier code formatting
```

### Docker Deployment

```bash
docker build -t specpilot .
docker run -e GEMINI_API_KEY=your-key -p 3001:3001 specpilot
```

---

## 📁 Project Structure

```
app/
├── src/
│   ├── generation/              # Core generation & LLM orchestration
│   │   ├── contract.ts          # Single source of truth: all enums, types, formats
│   │   ├── llmGenService.ts     # Orchestration: gap-analysis → generate → regenerate
│   │   ├── genService.ts        # Deterministic (offline) generator orchestrator
│   │   ├── prdGen.ts            # PRD fallback generator (pure function)
│   │   ├── trsGen.ts            # TRS fallback generator (pure function)
│   │   ├── uxGen.ts             # UX fallback generator (pure function)
│   │   ├── sectionSchema.ts     # Section names per format (authoritative layout)
│   │   ├── sessionMemory.ts     # localStorage wrapper; recency-weighted preference learning
│   │   └── validate.ts          # Zod schemas for request validation
│   │
│   ├── features/                # React UI components
│   │   ├── input/               # InputForm, GuidedQuestionsPanel
│   │   ├── profile/             # GenerationProfileScreen (templates, modes, controls)
│   │   ├── output/              # DocumentTabs, EditPane, PreviewPane, FeedbackControls
│   │   ├── export/              # ExportControls (Word/PDF/HTML)
│   │   └── history/             # SessionHistoryPanel, recency-weighted voting UI
│   │
│   ├── api/
│   │   ├── llmClient.ts         # Typed fetch wrappers for /_api/* routes
│   │   └── client.ts            # Generic axios client (template, mostly unused)
│   │
│   ├── export/
│   │   └── exportService.ts     # Word (docx), PDF, HTML builders
│   │
│   ├── App.tsx                  # Top-level state machine & orchestration
│   ├── theme/                   # Mantine Dark theme + CSS tokens
│   └── main.tsx                 # React DOM entry point
│
├── tests/                       # Vitest suite (mirrors src/ structure)
│   ├── generation/              # prdGen.test.ts, trsGen.test.ts, etc.
│   ├── export/                  # exportService.test.ts
│   ├── api/                     # llmClient.test.ts
│   └── server/                  # server tests (prompt assembly, retry logic, etc.)
│
├── server.mjs                   # Production Express server (Gemini gateway, self-contained)
├── vite.config.ts               # Dev server config + createLlmDevPlugin (identical LLM logic)
├── tsconfig.json                # TypeScript strict configuration
├── eslint.config.js             # ESLint rules (strict, React-aware)
├── vitest.config.ts             # Vitest config (jsdom for React, node for server)
├── package.json                 # Dependencies & scripts
├── Dockerfile                   # Multi-stage build (prod image)
├── .env.example                 # Template: GEMINI_API_KEY, GEMINI_MODEL
└── index.html                   # SPA entry point
```

---

## 📊 Testing & Quality Assurance

**Coverage Areas**
- **React Components** (Vitest + Testing Library): InputForm, GenerationProfileScreen, OutputView, SessionHistoryPanel, ExportControls
- **Generation Logic** (Node environment): PRD/TRS/UX fallback generators, gap analysis, section reconstruction
- **LLM Integration** (Mocked responses): Prompt assembly, schema validation, retry logic, error handling
- **Export Pipeline** (Browser+Node): Markdown → Word (docx), PDF rendering, HTML mockup generation

**Quality Checks**
- **TypeScript** — Strict mode; zero `any` types accepted; compile-time safety
- **ESLint** — React hooks rules, best practices, code style consistency
- **Prettier** — Automatic code formatting on commit
- **Vitest** — Fast unit tests with jsdom (React) and node (server logic)

**Run Tests**
```bash
npm test              # Run once
npm run test:watch   # Watch mode
npm run lint         # Linting
npm run format       # Formatting
npm run build        # TypeScript + Vite build (catches type errors)
```

---

## 📚 Documentation & References

- **[UserManual.md](./docs/UserManual.md)** — Complete end-user guide: workflow, features, best practices, common mistakes, FAQ
- **[DeveloperDocs.md](./docs/DeveloperDocs.md)** — Architecture deep-dive, API spec, LLM integration, troubleshooting guide
- **[CLAUDE.md](./CLAUDE.md)** — Quick reference for developers: build commands, architectural constraints, contribution guidelines

---

## 👤 Author & Attribution

**Elena Ellis**  
Full-Stack Developer | LLM Integration | Prompt Engineering | React + Node.js  
Email: kirantellis@gmail.com

---

## 🎓 Key Technical Accomplishments Demonstrated

✅ **Advanced AI Engineering**
- Structured prompt engineering with multi-format instruction layers (Volere, EARS, C4, etc.)
- Deterministic JSON schema validation and fallback recovery
- Multi-turn conversational flow with gap analysis and clarification questions

✅ **Production-Grade Resilience**
- Graceful degradation with offline-capable fallback generators
- Per-document-type error isolation (one failure doesn't block others)
- Transparent source tracking and clear user feedback

✅ **Human-Centered AI UX**
- Section-level feedback controls (👍/👎) with intent preservation
- Iterative regeneration maintaining user edits
- Smart session memory learning user preferences

✅ **Full-Stack TypeScript Development**
- Single source of truth for types (contract.ts)
- Type-safe API contract between frontend and backend
- Strict mode; zero `any` types; compile-time safety

✅ **Enterprise Features**
- Requirement ID generation and traceability mapping
- ASPICE and ISO 26262 compliance framing
- Multi-format export (Word, PDF, HTML)

✅ **Performance & Optimization**
- Parallel document generation
- Vite sub-millisecond HMR for rapid iteration
- Browser storage optimization (20-session cap, FIFO eviction)

---

## 📝 License

MIT License — see [LICENSE](./LICENSE) for details.

---

*SpecPilot demonstrates full-stack AI application development, from intelligent prompt engineering and deterministic fallback design to production-ready error handling, human-feedback integration, and regulatory compliance controls. Perfect for showcasing engineering depth in AI-powered systems.*
