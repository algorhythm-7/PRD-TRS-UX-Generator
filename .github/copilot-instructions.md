# Repository-wide Copilot Instructions

These instructions apply to all Copilot interactions within this repository.

---

## Core Principles

Always understand the existing code before proposing or making changes.

Prefer evidence from source code over assumptions.

If information cannot be verified from the repository:

- state the uncertainty
- explain what evidence is missing
- do not guess

---

## Engineering Priorities

Optimize for:

1. correctness
2. maintainability
3. clarity
4. consistency
5. minimal scope

Do not optimize for cleverness.

Prefer the simplest solution that fully satisfies the requirement.

---

## Existing Code First

Before introducing anything new:

- inspect existing implementations
- reuse existing patterns
- reuse existing contracts
- reuse existing utilities
- reuse existing validation

Prefer extension over replacement.

Do not create duplicate abstractions when an existing abstraction can be extended safely.

---

## Changes

Keep changes tightly scoped.

Avoid touching unrelated files.

Avoid unrelated refactors.

Avoid introducing new dependencies unless there is a clear, documented justification.

Do not change build tooling, deployment configuration, package management, or project structure unless explicitly requested.

---

## Architecture

Respect existing architectural boundaries.

Do not redesign the system unless explicitly requested.

When proposing architecture changes:

- identify current architecture
- identify constraints
- explain tradeoffs
- identify affected components

---

## Testing

Prefer updating existing tests over creating redundant tests.

Do not modify unrelated tests.

Preserve existing verified behavior unless intentionally changing requirements.

---

## Documentation

Keep documentation concise and evidence-based.

Avoid large source code dumps.

Prefer:

- findings
- evidence
- impact

When referencing code:

include file paths and symbol names whenever useful.

---

## Repository Analysis

When analyzing the codebase:

1. inspect repository structure first
2. search symbols before opening large files
3. avoid rereading files unnecessarily
4. inspect only relevant tests
5. ignore node_modules and build artifacts unless required

---

## Uncertainty

Use the following standards:

- CONFIRMED = directly supported by source code
- INFERRED = supported indirectly by evidence
- UNKNOWN = cannot be determined from the repository

Never present INFERRED or UNKNOWN findings as CONFIRMED.

---

## Preferred Workflow

For substantial changes:

1. Audit
2. Plan
3. Implement
4. Verify

Do not skip directly from requirements to implementation for large features.