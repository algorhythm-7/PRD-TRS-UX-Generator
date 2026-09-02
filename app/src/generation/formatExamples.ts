import type { DocType, DocumentFormatId } from "./contract";

/** One illustrative, hand-authored worked example per named format (docs/GoodTRSPRDUX2.md),
 * shown as a hover/focus preview on the Generation Profile screen's Template radiogroup so a
 * user can see roughly how each format actually reads before choosing it. These are static
 * examples for display only - not generated content, and never sent to the model. All examples
 * use the same fictitious product ("Acme Widget", a small-team task tracker) so the 9 formats are
 * easy to compare side by side. Content deliberately mirrors each format's own FORMAT_GUIDANCE
 * instructions (server.mjs/vite.config.ts) - e.g. Volere's Fit Criteria, EARS's six sentence
 * patterns, C4's four zoom levels - so this is a faithful preview of the real prompt behavior,
 * not a generic mockup. "standard" and "custom" are intentionally omitted: Standard is already
 * the well-known default, and Custom has no fixed structure to preview until a file is uploaded
 * (its own upload control already shows the extracted sections once available). */
export interface FormatExample {
  /** One-line summary of what makes this format distinct, shown above the preview. */
  description: string;
  /** A short, truncated worked example using the format's real section names/style. */
  preview: string;
}

export const FORMAT_EXAMPLES: Partial<Record<DocType, Partial<Record<DocumentFormatId, FormatExample>>>> = {
  PRD: {
    volere: {
      description: "16 sections; each Functional Requirement gets a measurable Fit Criterion; Risks and Open Issues are kept separate.",
      preview:
        "## 1. Purpose of the Project\n" +
        "Enable small teams to track tasks without per-seat licensing costs.\n\n" +
        "## 2. Stakeholders\n" +
        "Project Lead, Team Member, Billing Admin.\n\n" +
        "## 7. Functional Requirements\n" +
        "The product shall let a user create a task. Fit Criterion: the task appears in the " +
        "list within 1 second of submission.\n\n" +
        "…+ 13 more sections (Mandated Constraints, Scope of the Work, Scope of the Product, " +
        "Look and Feel, Usability and Humanity, Performance, Operational and Environmental, " +
        "Maintainability and Support, Security, Compliance, Risks, Open Issues)",
    },
    pr_faq: {
      description: "Amazon-style 'Working Backwards' press release + FAQ, written in the customer's voice.",
      preview:
        "## Press Release Heading\n" +
        "Acme Widget Launches Task Tracking Without the Per-Seat Tax\n\n" +
        "## Problem Paragraph\n" +
        "\"I was paying for five seats my interns never used,\" says one early customer.\n\n" +
        "## Solution Paragraph\n" +
        "Acme Widget charges one flat fee per project, never per person.\n\n" +
        "…+ 8 more sections (Sub-heading, Summary, Leadership Quote, How to Get Started, " +
        "Customer Quote, Call to Action, Internal FAQ, External FAQ)",
    },
    shape_up: {
      description: "Basecamp 'Shape Up' pitch - a fixed time-box appetite, not a full spec.",
      preview:
        "## Problem\n" +
        "Teams of 3-15 people can't justify per-seat task-tracking tools.\n\n" +
        "## Appetite\n" +
        "6 weeks.\n\n" +
        "## Solution\n" +
        "A flat-rate, project-based tracker with offline mode.\n\n" +
        "## Rabbit Holes\n" +
        "Offline sync conflict resolution could balloon in scope.\n\n" +
        "## No-gos\n" +
        "No native mobile app in this cycle.",
    },
  },
  TRS: {
    ears: {
      description: "Same sections as Standard TRS, but every requirement is phrased in one of six EARS patterns.",
      preview:
        "## 5. Non-Functional Requirements\n" +
        "WHEN a user submits a new task, THE system SHALL display it in the task list within " +
        "1 second.\n\n" +
        "WHILE the device is offline, THE system SHALL queue task changes locally.\n\n" +
        "IF a sync conflict is detected, THEN THE system SHALL prompt the user to choose a " +
        "version.\n\n" +
        "(All other sections keep the Standard TRS structure - only the requirement sentences " +
        "themselves change.)",
    },
    formal_srs: {
      description: "IEEE 830 / ISO-IEC-IEEE 29148 outline; Software System Attributes covers 5 named quality categories separately.",
      preview:
        "## Purpose and Scope\n" +
        "Defines the technical scope of Acme Widget's task-tracking capability for small " +
        "teams.\n\n" +
        "## Overall Description\n" +
        "Product perspective: a standalone SaaS web app. Product functions: create/assign/" +
        "track tasks. User characteristics: non-technical small-team members.\n\n" +
        "## Software System Attributes\n" +
        "Reliability: 99.5% uptime. Security: OAuth2 authentication. Maintainability: modular " +
        "service boundaries. Portability: containerized deployment.\n\n" +
        "…+ 6 more sections (External Interface Requirements, Functional Requirements, " +
        "Performance Requirements, Logical Database Requirements, Environment " +
        "Characteristics, Other Requirements)",
    },
    c4_model: {
      description: "Replaces High Level Architecture/System Boundaries with 4 zoom levels: Context, Containers, Components, Dynamic Scenarios.",
      preview:
        "## System Context\n" +
        "Actors: Team Member, Project Lead. External systems: Slack, email provider.\n\n" +
        "## Containers\n" +
        "Web SPA (React), API Service (Node/Express), PostgreSQL database.\n\n" +
        "## Components\n" +
        "Task Service, Auth Service, and Notification Service within the API container.\n\n" +
        "## Dynamic Scenarios\n" +
        "User creates a task → SPA calls Task Service → Task Service writes to PostgreSQL → " +
        "Notification Service posts to Slack.\n\n" +
        "(Summary, Problem Statement, and the rest of Standard TRS are kept as-is; only the " +
        "architecture sections are replaced.)",
    },
  },
  UX: {
    service_blueprint: {
      description: "NN/g Service Blueprint - splits actions into customer-facing, frontstage, and backstage layers.",
      preview:
        "## Customer Actions\n" +
        "Team member opens the app, creates a task, assigns an owner.\n\n" +
        "## Frontstage Actions\n" +
        "App shows a confirmation toast (self-service, human-to-computer).\n\n" +
        "## Backstage Actions\n" +
        "Notification Service posts to the assignee's Slack channel.\n\n" +
        "## Supporting Processes\n" +
        "A background sync job reconciles offline changes.\n\n" +
        "## Evidence (Physical and Digital Touchpoints)\n" +
        "The task card itself; the Slack message the assignee receives.",
    },
    jtbd: {
      description: "Jobs-to-Be-Done - Job Stories follow \"When <situation>, I want to <motivation>, so I can <outcome>\".",
      preview:
        "## Core Jobs to Be Done\n" +
        "When I'm juggling five client projects, I want one place to see what's overdue, so I " +
        "can look reliable to my clients.\n\n" +
        "## Job Stories\n" +
        "When a task is 1 day from its deadline, I want to be notified automatically, so I " +
        "can react before it's late.",
    },
    atomic_design: {
      description: "Brad Frost's Atomic Design - Atoms compose into Molecules, Organisms, Templates, then populated Pages.",
      preview:
        "## Atoms (Base UI Elements)\n" +
        "Task Checkbox, Due-Date Badge, Owner Avatar.\n\n" +
        "## Molecules (Component Groups)\n" +
        "Task Row (Checkbox + Title + Due-Date Badge + Owner Avatar).\n\n" +
        "## Organisms (Composite Interface Sections)\n" +
        "Project Task List (a stack of Task Rows plus a filter bar).\n\n" +
        "## Templates (Page-Level Layouts)\n" +
        "Project Dashboard Layout (sidebar + Task List + detail panel).\n\n" +
        "## Pages (Populated Screens)\n" +
        "\"Acme Q3 Launch\" project dashboard, populated with 12 real tasks.",
    },
  },
};
