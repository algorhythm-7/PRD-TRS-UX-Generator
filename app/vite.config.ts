import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import type { IncomingMessage, ServerResponse } from "http";

interface TokenCache {
  token: string;
  expiresAt: number;
}

/** Multimodal message content (e.g. PDF-as-inline-data). */
type LlmMessageContent =
  | string
  | Array<{ type: string; text?: string; image_url?: { url: string } }>;

function createOAuthProxyPlugin(env: Record<string, string>): Plugin {
  const tokenUrl =
    env.OAUTH_TOKEN_URL || "https://XYZ.Org.com/oauth2/token";
  const clientId = env.OAUTH_CLIENT_ID || "";
  const clientSecret = env.OAUTH_CLIENT_SECRET || "";
  const audience = env.OAUTH_AUDIENCE || "default";
  const scope = env.OAUTH_SCOPE || "read write";

  let cached: TokenCache | null = null;
  let pendingFetch: Promise<string> | null = null;

  const oauthEnabled = Boolean(clientId && clientSecret);

  async function fetchToken(): Promise<string> {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64",
    );

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope,
        audience,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `OAuth token request failed: ${res.status} ${res.statusText} – ${body}`,
      );
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };

    cached = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    console.log(
      `[oauth-proxy] Token acquired, expires in ${data.expires_in}s`,
    );
    return cached.token;
  }

  async function getAccessToken(): Promise<string> {
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }

    if (!pendingFetch) {
      pendingFetch = fetchToken().finally(() => {
        pendingFetch = null;
      });
    }
    return pendingFetch;
  }

  return {
    name: "oauth-proxy",
    configureServer(server) {
      if (!oauthEnabled) {
        console.log(
          "[oauth-proxy] OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET not set – proxy will forward requests without auth",
        );
        return;
      }

      console.log(`[oauth-proxy] Enabled – tokens from ${tokenUrl}`);

      server.middlewares.use(
        (
          req: IncomingMessage,
          _res: ServerResponse,
          next: (err?: unknown) => void,
        ) => {
          if (!req.url?.startsWith("/_api")) {
            next();
            return;
          }

          getAccessToken()
            .then((token) => {
              req.headers["authorization"] = `Bearer ${token}`;
              next();
            })
            .catch((err) => {
              console.error("[oauth-proxy] Failed to obtain token:", err);
              next();
            });
        },
      );
    },
  };
}

const GAP_ANALYSIS_SYSTEM_PROMPT =
  "You are a requirements analyst preparing to turn a product description into formal PRD/TRS/UX " +
  "documentation that meets professional standards (PRD: Atlassian/ProductPlan-style requirements " +
  "docs; TRS: ISO/IEC/IEEE 29148 requirements engineering; UX: Nielsen Norman Group journey-mapping " +
  "and usability heuristics - see docs/GoodTRSPRDUX.md for the full research this is based on). " +
  "Before documents are generated, identify the most important missing information, ambiguities, " +
  "or contradictions that would prevent writing testable functional requirements, measurable " +
  "success criteria, a specific (non-generic) user persona and journey, or complete non-functional " +
  "requirement categories (reliability, availability, security, maintainability, portability, " +
  "performance) - whichever are relevant to the selected document type(s). Ask at most 5 essential " +
  "clarifying questions, prioritized by which gaps would most improve the final documents. If the " +
  "information is already sufficient, return an empty question list. Do not ask about anything " +
  "already answered in the provided fields. Be concise - one short, specific question per item.";

/** Condensed guidance per docType, distilled from docs/GoodTRSPRDUX.md, used to steer the LLM
 * toward professional-standard content instead of generic filler. Keep in sync with server.mjs. */
const DOC_TYPE_GUIDANCE: Record<string, string> = {
  PRD:
    "Follow these standards per section: Problem Statement - a specific, real user/business " +
    "pain, not a restatement of the solution. Business Case - name who benefits and how the " +
    "benefit will be measured or observed; avoid vague claims. Proposed Solution - describe the " +
    "approach at a level readable by a non-technical stakeholder; do not dictate implementation " +
    'detail. Functional Requirements - each requirement must be necessary, unambiguous, and ' +
    'testable, phrased as "the product shall..."; group related requirements. User Personas and ' +
    "their Journey - name a specific persona (role, trigger, outcome) and a real journey - never " +
    'write "a user who needs the product." Exclusions - name specific deferred capabilities, not ' +
    "just a generic disclaimer. Success Criteria - include a measurable signal or number wherever " +
    "possible. Assumptions - state pre-conditions expected to be true but not guaranteed. Risks " +
    "and Dependencies - name plausible failure modes and concrete external dependencies.",
  TRS:
    "Follow these standards per section: Summary - a short technical abstract for an engineering " +
    "audience. Problem Statement and Proposed Solution - the technical framing of the problem and " +
    "the approach at a component level. High Level Architecture - name the actual " +
    "components/layers and how they communicate; be specific to what was described, not generic " +
    'filler. System Boundaries - state exactly what is in scope vs. an external dependency/actor. ' +
    "Non-Functional Requirements - address the standard categories concretely wherever relevant: " +
    "reliability, availability, security, maintainability, portability, and performance (e.g. " +
    '"responds within N seconds" is testable; "is fast" is a requirement smell). Data ' +
    "Requirements - what data is created/read/stored and its sensitivity. Integration " +
    "Requirements - name the actual external systems/APIs implied by the input. UI Requirements - " +
    "describe functional needs (views, roles, states), not visual design. Test and Validation - " +
    "reference how the functional and non-functional requirements above will be verified, not " +
    "generic test-type filler. Risks and Dependencies - technical risks distinct from " +
    "business-level ones. Deployments - concrete to what was described. AI Usage and " +
    "Implications - describe AI/ML use in the product being specified, if any is implied by the " +
    "input, and its data/explainability/fallback implications; otherwise state plainly that none " +
    "is used. Avoid requirement smells: subjective language, ambiguous adverbs/adjectives, " +
    'superlatives, negative statements without a testable positive alternative, and words ' +
    'implying totality ("always", "never", "all") without justification.',
  UX:
    "For User Journeys for personas: include, for each persona, all five journey-mapping " +
    "components - (1) a specific Actor/persona, not a generic \"user\"; (2) the Scenario and " +
    "Expectations driving the journey; (3) Journey Phases appropriate to this specific product " +
    "(not a generic four-step list); (4) Actions, Mindsets, and Emotions at each phase - include " +
    "what the persona thinks or feels, not just a list of clicks; (5) Opportunities the journey " +
    "reveals for improving the product. For UI Design Mockups: represent the actual screens/views " +
    "implied by the product's functional needs, and apply usability heuristics as a content " +
    "checklist - show where system status/feedback appears, use the product's own domain " +
    "terminology, show an obvious way to cancel/undo, keep each mockup focused on only what its " +
    "flow needs (no kitchen-sink screens).",
};

/** Condensed guidance per named format (docs/GoodTRSPRDUX2.md), appended after DOC_TYPE_GUIDANCE
 * when the caller selects that format instead of "standard". */
const FORMAT_GUIDANCE: Record<string, string> = {
  volere:
    "Follow the Volere Requirements Specification style: give each Functional Requirement an " +
    'implicit Fit Criterion - a measurable, testable pass/fail condition (e.g. "responds within ' +
    '2 seconds for 95% of requests", not "is fast"). Purpose of the Project - one paragraph on ' +
    'why the project exists in business terms. Stakeholders - named roles, not "the user". ' +
    "Mandated Constraints - what the solution must satisfy regardless of design choice (budget, " +
    "timeline, technology/regulatory mandate), distinct from a technical Non-Functional " +
    "Requirement. Scope of the Work vs. Scope of the Product - keep separate: Scope of the Work " +
    "is the business process being changed; Scope of the Product is what the software itself " +
    "does. Treat Look and Feel, Usability and Humanity, Performance, Operational and " +
    "Environmental, Maintainability and Support, Security, and Compliance Requirements as " +
    "distinct categories - never merge them into one generic paragraph. Risks and Open Issues " +
    "are two separate lists: Risks are things that might go wrong; Open Issues are unresolved " +
    "questions blocking further design.",
  pr_faq:
    "Write as an Amazon-style 'Working Backwards' PR/FAQ: the Press Release Heading and " +
    "Sub-heading must be understandable by the actual target customer, not internal jargon. " +
    "Problem Paragraph is written from the customer's voice, not the business's. Solution " +
    "Paragraph describes a customer benefit, readable by a non-technical stakeholder, never a " +
    "feature list or implementation detail. Leadership Quote and Customer Quote must read like " +
    "something a real person would say, not a restatement of the paragraphs above. Internal FAQ " +
    "must surface genuinely hard questions (feasibility, cost, risk) - not softballs. External " +
    "FAQ must anticipate real objections a skeptical customer or journalist would raise.",
  shape_up:
    "Write as a Basecamp 'Shape Up' Pitch: Problem states a specific, real pain (same bar as a " +
    'Standard Problem Statement). Appetite must be a fixed time-box (e.g. "2 weeks", "6 weeks"), ' +
    'never a vague "as long as it takes". Solution is concrete enough to evaluate feasibility ' +
    "but is explicitly not a full implementation spec. Rabbit Holes name a specific " +
    'technical/design risk worth flagging in advance, not a generic "this could be tricky". ' +
    "No-gos name specific, deliberately excluded functionality or use cases, not a generic " +
    "disclaimer.",
  formal_srs:
    "Follow the IEEE 830 / ISO-IEC-IEEE 29148 Formal SRS Outline: Purpose and Scope is a short " +
    "technical abstract (definitions, background, system overview). Overall Description " +
    "addresses product perspective, product functions, user characteristics, and " +
    "constraints/assumptions as distinct sub-topics within one section. Software System " +
    "Attributes must individually address each of the five named categories - Reliability, " +
    "Availability, Security, Maintainability, Portability - never merged into one vague quality " +
    "statement. Apply the same testable/unambiguous requirement-quality bar as the Standard " +
    "format throughout.",
  c4_model:
    "Follow the C4 software-architecture model: System Context names the actors, external " +
    "systems, and the system's boundary. Containers names the major deployable/runnable units " +
    "and how they communicate. Components names the key components within each container and " +
    "their responsibilities. Dynamic Scenarios narrates how components collaborate for key use " +
    "cases. Each of these four stays at its own correct zoom level - do not collapse them into " +
    "one generic architecture paragraph. Deployment states where containers actually run.",
  service_blueprint:
    "Follow the Nielsen Norman Group Service Blueprint format: Customer Actions are derived from " +
    "the persona/journey already described, not a generic restatement. Frontstage Actions " +
    "distinguish human-to-human from human-to-computer (self-service) actions. Backstage Actions " +
    'name specific internal systems/roles, never a vague "the system processes this". Supporting ' +
    "Processes and Evidence name concrete physical/digital touchpoints (a specific screen, " +
    "email, or location), not abstractions.",
  jtbd:
    "Follow the Jobs-to-Be-Done format: Core Jobs to Be Done must name a real circumstance " +
    'driving the "hire", addressing all three dimensions - functional, social, and emotional - a ' +
    "purely functional job is incomplete. Job Stories must literally follow the sentence form " +
    '"When <situation>, I want to <motivation>, so I can <expected outcome>" - synthesize from ' +
    "the input, do not just reformat a generic persona statement.",
  atomic_design:
    "Follow Brad Frost's Atomic Design method: Atoms name concrete, product-specific UI elements " +
    '(not "a button" generically). Molecules and Organisms must be composed explicitly from the ' +
    "Atoms/Molecules already named, never introduced as unrelated new elements. Templates " +
    "describe content structure (what kind of content goes where), not final copy. Pages " +
    "populate a named Template with realistic, product-specific representative content, never " +
    "placeholder text.",
  custom:
    "Follow the exact section list provided for this document - infer the appropriate content " +
    "style and depth from the section names themselves, since no other guidance is available " +
    "for a user-provided template.",
};

/** EARS (Easy Approach to Requirements Syntax) phrasing overlay (docs/GoodTRSPRDUX2.md "TRS
 * Format 1") - layered on top of whichever section skeleton/format is in use. */
const EARS_GUIDANCE =
  "Phrase every functional and non-functional requirement sentence using exactly one of these " +
  "six EARS (Easy Approach to Requirements Syntax) patterns: Ubiquitous - \"THE <system> SHALL " +
  '<response>". Event-driven - "WHEN <trigger>, THE <system> SHALL <response>". State-driven - ' +
  '"WHILE <precondition>, THE <system> SHALL <response>". Optional feature - "WHERE <feature is ' +
  'present>, THE <system> SHALL <response>". Unwanted behavior - "IF <trigger>, THEN THE ' +
  '<system> SHALL <response>". Complex - a combination of the above patterns for multi-condition ' +
  "requirements. Name <system> concretely (the actual product/component), and make <response> " +
  "an observable, testable action. Do not force non-requirement prose (summaries, narrative " +
  "descriptions) into these patterns - they apply only to requirement-bearing sentences.";

/** Per-DocType Generation Mode guidance, replacing a generic Tone control
 * (docs/Enhancements3.md §3.2) - the default value per DocType matches today's Standard-format
 * prompt behavior exactly, so leaving Generation Mode untouched changes nothing. */
const GENERATION_MODE_GUIDANCE: Record<string, Record<string, string>> = {
  PRD: {
    customer_value:
      "Write for a customer/end-user reading this to understand what's in it for them - lead " +
      "with the benefit and outcome, minimize internal process or organizational language.",
    product_management:
      "Write for a product management audience - balance business rationale with enough detail " +
      "to plan and prioritize work; this is the default, standard-format tone.",
    engineering_handoff:
      "Write for an engineering audience about to scope implementation - be precise about " +
      "functional boundaries and constraints, while still avoiding implementation-level design " +
      "detail that belongs in the TRS.",
    executive_summary:
      "Write for a time-constrained executive audience: lead with business impact and a " +
      "one-paragraph summary before any detail; minimize technical/implementation language.",
  },
  TRS: {
    strict_trs:
      "Write a standard technical requirements specification - this is the default, " +
      "standard-format tone.",
    functional_decomposition:
      "Emphasize breaking the system down into its functional building blocks and how they " +
      "relate, more than narrative prose.",
    implementation_oriented:
      "Lean toward concrete implementation guidance where the input supports it (specific " +
      "technologies, protocols, data formats), while still stating requirements as capabilities, " +
      "not literal code.",
    verification_oriented:
      "For every requirement, explicitly state how it would be verified (test type, measurable " +
      "pass/fail condition), not just the requirement itself.",
  },
  UX: {
    user_journey:
      "Emphasize the persona's journey, mindset, and emotions at each phase - this is the " +
      "default, standard-format tone.",
    wireframe_generation:
      "Emphasize concrete, detailed UI Design Mockups over journey narrative - describe " +
      "screens/layouts in enough detail that a designer could start from them.",
    interaction_design:
      "Emphasize the specific interactions, states, and transitions a user experiences (what " +
      "happens on click, hover, error, success), not just a static screen description.",
    accessibility_focus:
      "For every journey phase and mockup, explicitly call out accessibility considerations " +
      "(screen-reader behavior, keyboard navigation, color-contrast-sensitive elements).",
    research_discovery:
      "Emphasize open questions, assumptions to validate, and research needed to confirm the " +
      "journey/design, more than a finished design recommendation.",
  },
};

/** Requirement Depth guidance (docs/Enhancements3.md §3.3). "standard_engineering" is the
 * default and matches today's existing behavior exactly, so it is intentionally empty. */
const REQUIREMENT_DEPTH_GUIDANCE: Record<string, string> = {
  high_level:
    "Keep requirements brief and capability-focused; omit rationale, edge-case, and " +
    "verification detail unless the input specifically calls for it.",
  standard_engineering: "",
  detailed_engineering:
    "For each requirement, add brief rationale and note any obvious edge cases the input " +
    "suggests, in addition to the requirement itself.",
  compliance_grade:
    "For each requirement, add explicit rationale, edge-case handling, and a " +
    "verification/traceability note - sufficient detail to support a compliance or safety-case " +
    "review.",
};

/** Requirement Decomposition guidance (docs/Enhancements3.md §3.3). "functional_requirement" is
 * the default and matches today's existing behavior exactly, so it is intentionally empty. */
const REQUIREMENT_DECOMPOSITION_GUIDANCE: Record<string, string> = {
  feature:
    "Phrase requirements at the feature level - describe user-facing capabilities as whole " +
    "features rather than decomposing into smaller functional units.",
  functional_requirement: "",
  sub_system:
    "Phrase requirements at the sub-system level - group related functionality into named " +
    "sub-systems and describe requirements per sub-system where the input supports it.",
  component:
    "Phrase requirements at the component level - break sub-systems down into individual " +
    "components and describe requirements per component where the input supports it.",
  signal_interface:
    "Phrase requirements down to individual signal/interface level where the input supports it.",
};

/** Assumption Strategy guidance (docs/Enhancements3.md §3.5). "balanced" is the default and
 * matches today's existing implicit behavior exactly, so it is intentionally empty. */
const ASSUMPTION_STRATEGY_GUIDANCE: Record<string, string> = {
  strict:
    "Do not invent information not present in the input or clarifications. Where information " +
    "is missing, explicitly list it as an Open Issue/Assumption rather than inventing a " +
    "plausible value.",
  balanced: "",
  exploratory:
    "Where information is missing, proactively propose a plausible, clearly-labeled option " +
    "rather than just flagging a gap - favor forward progress over asking more questions.",
};

/** Traceability ID conventions (docs/GoodTRSPRDUX2.md §5, docs/Enhancements3.md §4). Keyed by
 * docType; UX has no entry since it has no CRS/TRS-ID-bearing requirement sections. Whether
 * `requirementMapping` is meaningful for a given batch (a PRD must also be generated) is a
 * caller/batch-level concern, not this function's - the caller simply omits the flag when not
 * applicable. */
const TRACEABILITY_ID_GUIDANCE: Record<string, string> = {
  PRD:
    "Assign each Functional Requirement a stable CRS-<NNN> ID (e.g., CRS-PRD-001) so later " +
    "documents can reference it.",
  TRS: "Assign each technical/non-functional requirement a stable TRS-<NNN> ID (e.g., TRS-014).",
};
const TRACEABILITY_MAPPING_GUIDANCE: Record<string, string> = {
  TRS:
    "For each requirement, reference the CRS-ID(s) it fulfills where applicable, e.g., " +
    '"TRS-014 (fulfills CRS-PRD-003)".',
};
const TRACEABILITY_VERIFICATION_GUIDANCE: Record<string, string> = {
  TRS: "In the Test and Validation section, explicitly reference the requirement IDs each test verifies.",
};

interface TraceabilityFlags {
  generateIds?: boolean;
  requirementMapping?: boolean;
  verificationReferences?: boolean;
}

/** Compliance Framing guidance (docs/Enhancements3.md §3.4). Deliberately not part of
 * `FORMAT_GUIDANCE` - ASPICE/ISO 26262 are process/compliance standards, not document templates
 * (docs/GoodTRSPRDUX2.md §6), so this stays a separate, explicitly-scoped instruction. */
const COMPLIANCE_FRAMING_GUIDANCE = {
  aspice:
    "Frame requirements using ASPICE work-product-aware language (e.g., distinguish system vs. " +
    "software-level requirements) where the input supports it, without claiming this document " +
    "literally is an ASPICE work product.",
  iso26262:
    "Explicitly flag any requirement that appears safety-relevant in ISO 26262 terms (e.g., " +
    "affects vehicle control, occupant safety) as such.",
};

interface ComplianceFramingFlags {
  aspice?: boolean;
  iso26262?: boolean;
}

/** Output Structure guidance (docs/Enhancements4.md §6.2), keyed by the same item names the
 * client passes through `sectionNamesFor`'s `additionalSections` (docs/Enhancements4.md §6.3).
 * `OUTPUT_STRUCTURE_APPLICABILITY` mirrors that table's "Applicable to" column so an item never
 * silently renders guidance for a docType it isn't meant for, even if the caller passes it. */
const OUTPUT_STRUCTURE_GUIDANCE: Record<string, string> = {
  "User Stories": 'Phrase as "As a <role>, I want <goal>, so that <benefit>".',
  "Acceptance Criteria": "Use Given/When/Then or a testable checklist per requirement.",
  Risks:
    "Name concrete, product-specific risks and their potential impact - never generic risk " +
    "categories.",
  Dependencies: "Name concrete external systems or teams relied on, not generic categories.",
  "Open Questions":
    "List unresolved items blocking further design or decisions, distinct from Risks.",
  "Wireframe Suggestions":
    "Provide a lightweight sketch of the relevant UI elements, without attempting a full UX " +
    "document.",
  "Edge Cases":
    "Explicitly call out boundary and failure conditions not already covered by the main " +
    "requirements.",
  "Validation Criteria":
    "For each requirement, state how it would be verified (test type, measurable pass/fail " +
    "condition).",
};
const OUTPUT_STRUCTURE_APPLICABILITY: Record<string, readonly string[]> = {
  "User Stories": ["PRD", "UX"],
  "Acceptance Criteria": ["PRD", "TRS"],
  Risks: ["PRD", "TRS", "UX"],
  Dependencies: ["PRD", "TRS"],
  "Open Questions": ["PRD", "TRS"],
  "Wireframe Suggestions": ["PRD", "TRS"],
  "Edge Cases": ["PRD", "TRS"],
  "Validation Criteria": ["TRS"],
};

/** Innovation Assistance (docs/Enhancements3.md §3 continued) - each level pairs a `temperature`
 * value with a distinct prompt instruction. Both `.guidance` and `.temperature` are consumed by
 * `buildGenerateSystemPrompt`/`handleGenerate` today (the `temperature` is passed straight
 * through to `callGemini`). */
const INNOVATION_ASSISTANCE: Record<string, { temperature: number; guidance: string }> = {
  disabled: {
    temperature: 0.2,
    guidance:
      "Do not propose anything beyond what is explicitly stated or reasonably implied by the " +
      "input.",
  },
  suggest_missing: {
    temperature: 0.4,
    guidance:
      "Additionally identify and explicitly propose requirements you believe are missing, " +
      "clearly labeled as suggestions, not confirmed requirements.",
  },
  challenge_assumptions: {
    temperature: 0.6,
    guidance:
      "Where the input states or implies an assumption, explicitly question it and propose an " +
      "alternative if one seems stronger, clearly labeled as a challenge to the stated " +
      "assumption.",
  },
  explore_alternatives: {
    temperature: 0.8,
    guidance:
      "Propose at least one clearly-labeled alternative approach in addition to the primary " +
      "one described.",
  },
  maximum_ideation: {
    temperature: 1.0,
    guidance:
      "Be maximally exploratory: propose novel ideas, alternative designs, and additional " +
      "requirements liberally, all clearly and consistently labeled as ideation rather than " +
      "confirmed requirements or the primary recommendation.",
  },
};

/** A raised Innovation Assistance level also raises Gemini's `temperature` (see
 * `INNOVATION_ASSISTANCE` above), which affects the model's writing throughout the whole
 * response - not just the specifically-labeled suggestion/challenge/ideation additions each
 * level's own guidance asks for. This keeps the core, directly-requested content grounded
 * regardless of temperature, so added creativity stays confined to what's explicitly labeled as
 * such. Intentionally omitted at "disabled" (temperature 0.2, already the most conservative
 * setting) to avoid prompt bloat where it adds no value. */
const INNOVATION_GROUNDING_GUIDANCE =
  "A higher creativity setting is active for this generation. Regardless of that setting, keep " +
  "every directly-requested, input-grounded part of the document strictly grounded in the " +
  "provided input and clarifications - confine any added creativity, speculation, or " +
  "exploratory ideas strictly to the clearly-labeled additions already described above, and " +
  "never let unlabeled speculation blend into the core requirements/content.";

/** Target Audience guidance (docs/Enhancements3.md §5). Each docType's documented default
 * audience (PRD/UX: "product", TRS: "engineering") is intentionally empty - it matches today's
 * existing Standard-format assumed audience exactly. */
const TARGET_AUDIENCE_GUIDANCE: Record<string, Record<string, string>> = {
  PRD: {
    engineering:
      "Write with more technical precision than the standard product-management tone, calling " +
      "out implementation-relevant constraints where the input supports it.",
    product: "",
    customer:
      "Write using the customer's own vocabulary, minimizing internal organizational or " +
      "technical jargon.",
    management:
      "Lead with business impact and resourcing implications; keep technical detail to a " +
      "minimum.",
  },
  TRS: {
    engineering: "",
    product:
      "Write with less implementation detail and more emphasis on what capability each " +
      "requirement delivers, for a product-management audience.",
    customer:
      "Write using plain, non-technical language a customer could follow, minimizing internal " +
      "engineering terminology.",
    management:
      "Lead with business impact and resourcing implications; keep technical detail to a " +
      "minimum.",
  },
  UX: {
    engineering:
      "Write with more attention to implementation feasibility and technical constraints " +
      "alongside the usual journey/design detail.",
    product: "",
    customer:
      "Write using the customer's own vocabulary, minimizing internal organizational or " +
      "technical jargon.",
    management:
      "Lead with business impact and resourcing implications; keep technical/design detail to " +
      "a minimum.",
  },
};

interface ReferenceContentPayload {
  documents?: string[];
  styleExample?: string;
}

/** docs/Enhancements4.md §4/§5.3/§7 - reference content assembled client-side (uploaded
 * documents + a style-example document), rendered here as one or two clearly-scoped, non-
 * authoritative context blocks. No exact wording is given in the plan for uploaded documents
 * (only for the style example, used verbatim below) - authored following the same "reference
 * material, not literal output" framing. */
function buildReferenceContentBlock(referenceContent?: ReferenceContentPayload): string {
  if (!referenceContent) return "";
  const parts: string[] = [];
  if (referenceContent.documents?.length) {
    parts.push(
      "The following are reference documents provided for background context only - use them " +
      "to inform accuracy and terminology, but do not copy their content verbatim or treat " +
      "them as more authoritative than the product title/details above: " +
      referenceContent.documents.join("\n---\n"),
    );
  }
  if (referenceContent.styleExample) {
    parts.push(
      "The following is an example of a previously generated document of the same type, " +
      "provided only as a style/structure reference - do not copy its specific content, only " +
      `its tone and level of detail: ${referenceContent.styleExample}`,
    );
  }
  return parts.join(" ");
}

interface PriorAttemptPayload {
  originalContent: string;
  editedContent: string;
  comment?: string;
  sectionSignals?: Record<string, "keep" | "rewrite">;
}

/** docs/Enhancements2.md §4.4 - appended to the user message (not the system prompt), verbatim
 * wording from that section. `idStabilityNote` is a best-effort mitigation, not a real fix -
 * there is no persisted ID registry, so this only asks the model to reuse IDs it can see in the
 * edited version; it cannot guarantee stability the way a real registry would. */
function buildPriorAttemptBlock(priorAttempt?: PriorAttemptPayload): string | undefined {
  if (!priorAttempt) return undefined;
  const { originalContent, editedContent, comment, sectionSignals } = priorAttempt;
  const rewriteSections = Object.entries(sectionSignals ?? {})
    .filter(([, signal]) => signal === "rewrite")
    .map(([name]) => name);
  const rewriteNote = rewriteSections.length
    ? "The user marked these sections for rewriting from scratch rather than refinement: " +
    rewriteSections.join(", ") +
    "; treat all other sections as ones to preserve and only lightly refine."
    : "";
  const idStabilityNote =
    "If the edited version already contains requirement IDs (e.g. CRS-001, TRS-014), reuse " +
    "those exact IDs for any requirement you keep or only lightly refine - only assign a new ID " +
    "to a requirement that is genuinely new in this regeneration.";
  const parts = [
    "The user previously generated this document and made the following edits. Learn from " +
    "what they changed - preserve the intent and improvements in their edited version, and " +
    "do not reintroduce content they removed or changed, unless it's still necessary to " +
    "satisfy the requested sections.",
    comment ? `Additional instruction from the user: ${comment}.` : "",
    rewriteNote,
    idStabilityNote,
    `--- ORIGINAL ---\n${originalContent}`,
    `--- USER'S EDITED VERSION ---\n${editedContent}`,
  ];
  return parts.filter(Boolean).join(" ");
}

/** Builds the per-docType generate system prompt, informed by docs/GoodTRSPRDUX.md. Assembly
 * order (docs/Enhancements3.md §8, docs/Enhancements4.md §7): base -> DOC_TYPE_GUIDANCE ->
 * FORMAT_GUIDANCE -> EARS (if applicable) -> GENERATION_MODE_GUIDANCE -> Target Audience (if
 * given; placed alongside Generation Mode since both are audience/lens controls - the plan's own
 * assembly-order lists never actually mention Target Audience, so this placement is an authored
 * resolution, not a documented requirement) -> Depth/Decomposition -> Traceability (if enabled)
 * -> Assumption Strategy -> Compliance Framing (if enabled) -> Output Structure guidance ->
 * reference-content block -> Innovation Assistance guidance -> closing instruction.
 * `targetAudience`/`referenceContent` are appended at the end of the parameter list (not inserted
 * where they logically read) so every existing positional call site/test is unaffected - the
 * `parts` array below, not parameter order, controls the actual prompt order. Every guidance
 * param defaults to a no-op matching today's exact behavior, so a call passing only docType is
 * unaffected. Empty guidance strings are filtered out so omitted blocks never leave stray double
 * spaces. */
export function buildGenerateSystemPrompt(
  docType: string,
  format = "standard",
  requirementPhrasing = "prose",
  generationMode?: string,
  requirementDepth = "standard_engineering",
  requirementDecomposition = "functional_requirement",
  traceability?: TraceabilityFlags,
  assumptionStrategy = "balanced",
  complianceFraming?: ComplianceFramingFlags,
  outputStructureItems?: string[],
  innovationAssistance?: string,
  targetAudience?: string,
  referenceContent?: ReferenceContentPayload,
): string {
  const traceabilityParts: string[] = [];
  if (traceability?.generateIds) {
    traceabilityParts.push(TRACEABILITY_ID_GUIDANCE[docType] ?? "");
    if (traceability.requirementMapping) {
      traceabilityParts.push(TRACEABILITY_MAPPING_GUIDANCE[docType] ?? "");
    }
    if (traceability.verificationReferences) {
      traceabilityParts.push(TRACEABILITY_VERIFICATION_GUIDANCE[docType] ?? "");
    }
  }
  const complianceParts = [
    complianceFraming?.aspice ? COMPLIANCE_FRAMING_GUIDANCE.aspice : "",
    complianceFraming?.iso26262 ? COMPLIANCE_FRAMING_GUIDANCE.iso26262 : "",
  ];
  const outputStructureParts = (outputStructureItems ?? [])
    .filter((item) => OUTPUT_STRUCTURE_APPLICABILITY[item]?.includes(docType))
    .map((item) => OUTPUT_STRUCTURE_GUIDANCE[item] ?? "");
  const parts = [
    `You are a senior product/technical writer generating a ${docType} document, following ` +
    "professional documentation standards.",
    DOC_TYPE_GUIDANCE[docType] ?? "",
    FORMAT_GUIDANCE[format] ?? "",
    requirementPhrasing === "ears" ? EARS_GUIDANCE : "",
    generationMode ? GENERATION_MODE_GUIDANCE[docType]?.[generationMode] ?? "" : "",
    targetAudience ? TARGET_AUDIENCE_GUIDANCE[docType]?.[targetAudience] ?? "" : "",
    REQUIREMENT_DEPTH_GUIDANCE[requirementDepth] ?? "",
    REQUIREMENT_DECOMPOSITION_GUIDANCE[requirementDecomposition] ?? "",
    ...traceabilityParts,
    ASSUMPTION_STRATEGY_GUIDANCE[assumptionStrategy] ?? "",
    ...complianceParts,
    ...outputStructureParts,
    buildReferenceContentBlock(referenceContent),
    innovationAssistance ? INNOVATION_ASSISTANCE[innovationAssistance]?.guidance ?? "" : "",
    innovationAssistance && innovationAssistance !== "disabled" ? INNOVATION_GROUNDING_GUIDANCE : "",
    "Use the product title, details, and answers provided. Do not invent section names beyond " +
    "what is requested. Be specific to the described product - never use generic placeholder " +
    "language when concrete information is available in the inputs. Write clean Markdown for " +
    'each section\'s body: use blank lines between paragraphs, "-" for bullet lists, and "###" ' +
    'for any sub-headings - the caller already adds a top-level "##" heading for each section, ' +
    "so never repeat that heading inside your own text.",
  ];
  return parts.filter(Boolean).join(" ");
}

function gapAnalysisSchema() {
  return {
    type: "json_schema",
    json_schema: {
      name: "gap_analysis",
      strict: true,
      schema: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                question: { type: "string" },
                relatedField: { type: "string" },
              },
              required: ["id", "question"],
              additionalProperties: false,
            },
          },
        },
        required: ["questions"],
        additionalProperties: false,
      },
    },
  };
}

function generateSchema(sections: string[]) {
  const properties: Record<string, { type: string }> = {};
  for (const name of sections) properties[name] = { type: "string" };
  return {
    type: "json_schema",
    json_schema: {
      name: "document_sections",
      strict: true,
      schema: { type: "object", properties, required: sections, additionalProperties: false },
    },
  };
}

const TEMPLATE_EXTRACT_SYSTEM_PROMPT =
  "Extract an ordered list of section/heading names from this requirements/product template. " +
  "Return only section names, no content, no numbering.";

export function templateExtractSchema() {
  return {
    type: "json_schema",
    json_schema: {
      name: "template_extract",
      strict: true,
      schema: {
        type: "object",
        properties: { sections: { type: "array", items: { type: "string" } } },
        required: ["sections"],
        additionalProperties: false,
      },
    },
  };
}

function pdfExtractSchema() {
  return {
    type: "json_schema",
    json_schema: {
      name: "pdf_extract",
      strict: true,
      schema: {
        type: "object",
        properties: { extractedText: { type: "string" } },
        required: ["extractedText"],
        additionalProperties: false,
      },
    },
  };
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

/** docs/Enhancements4.md §4.3 - enforces only the per-document cap (see the `contextExtractCharLimit`
 * comment below for why the combined/proportional-trim rule isn't implemented here). Pure and
 * exported so it can be unit-tested without going through the dev middleware. */
export function applyContextExtractBudget(
  rawText: string,
  limit: number,
): { extractedText: string; truncated: boolean } {
  const truncated = rawText.length > limit;
  return { extractedText: truncated ? rawText.slice(0, limit) : rawText, truncated };
}

/**
 * Dev-only counterpart to the /_api/gap-analysis, /_api/generate, /_api/llm-status and
 * /_api/llm-warmup handlers in server.mjs. Deliberately duplicated (not imported from
 * server.mjs) because: (a) the production Docker build only copies server.mjs into the
 * runtime image, so server.mjs must stay self-contained, and (b) importing server.mjs here
 * would also execute its unconditional startup side effects (app.listen, etc.). Keep this in
 * sync with server.mjs's LLM section when either changes.
 */
export function openAiSchemaToGemini(responseFormat: unknown): unknown {
  if (!responseFormat) return undefined;
  return (
    (responseFormat as { json_schema?: { schema?: unknown } })?.json_schema?.schema ??
    responseFormat
  );
}

function convertContentToParts(content: LlmMessageContent): Part[] {
  if (typeof content === "string") return [{ text: content }];
  if (Array.isArray(content)) {
    return content.map((block) => {
      if (block.type === "text" && block.text) return { text: block.text };
      if (block.type === "image_url" && block.image_url?.url) {
        const match = block.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
        if (match) return { inlineData: { mimeType: match[1], data: match[2] } };
      }
      return { text: JSON.stringify(block) };
    });
  }
  return [{ text: String(content) }];
}

function messagesToGemini(messages: Array<{ role: string; content: LlmMessageContent }>) {
  const systemInstruction = messages
    .filter((m) => m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .join("\n\n");
  const contents: Content[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
      parts: convertContentToParts(m.content),
    }));
  return { systemInstruction: systemInstruction || undefined, contents };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function createLlmDevPlugin(env: Record<string, string>): Plugin {
  const geminiApiKey = env.GEMINI_API_KEY || "";
  const geminiModel = env.GEMINI_MODEL || "gemini-2.0-flash";
  const geminiPdfModel = env.GEMINI_PDF_MODEL || geminiModel;
  const chatTimeoutMs = Number(env.GEMINI_CHAT_TIMEOUT_MS || 90000);
  const structuredAttemptTimeoutMs = Number(env.GEMINI_STRUCTURED_ATTEMPT_TIMEOUT_MS || 20000);
  const gapAnalysisMaxTokens = Number(env.GEMINI_GAP_ANALYSIS_MAX_TOKENS || 4096);
  const generateMaxTokens = Number(env.GEMINI_GENERATE_MAX_TOKENS || 8192);
  const templateExtractMaxTokens = Number(env.GEMINI_TEMPLATE_EXTRACT_MAX_TOKENS || 4096);
  const contextExtractCharLimit = Number(env.CONTEXT_EXTRACT_CHAR_LIMIT || 8000);
  const pdfExtractMaxTokens = Number(env.GEMINI_PDF_EXTRACT_MAX_TOKENS || 8192);

  function getGeminiClient(): GoogleGenerativeAI {
    if (!geminiApiKey) throw new Error("LLM_UNAVAILABLE");
    return new GoogleGenerativeAI(geminiApiKey);
  }

  function extractJsonBlock(text: string): unknown {
    const stripped = text.replace(/```json/gi, "```").replace(/```/g, "");
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
      throw new Error("No JSON object found in response");
    }
    return JSON.parse(stripped.slice(start, end + 1));
  }

  async function callGemini(
    messages: Array<{ role: string; content: LlmMessageContent }>,
    responseFormat: unknown,
    maxTokens: number,
    temperature?: number,
    modelId: string = geminiModel,
  ): Promise<unknown> {
    const { systemInstruction, contents } = messagesToGemini(messages);
    const attempts = responseFormat ? [{ withSchema: true }, { withSchema: false }] : [{ withSchema: false }];
    let lastError: unknown;
    const genAI = getGeminiClient();

    for (const attempt of attempts) {
      try {
        const generationConfig: Record<string, unknown> = { maxOutputTokens: maxTokens };
        if (temperature !== undefined) generationConfig.temperature = temperature;

        let requestContents: Content[] = contents;
        if (attempt.withSchema && responseFormat) {
          generationConfig.responseMimeType = "application/json";
          generationConfig.responseSchema = openAiSchemaToGemini(responseFormat);
        } else if (!attempt.withSchema && responseFormat) {
          const schema = openAiSchemaToGemini(responseFormat);
          const schemaPrompt =
            "The following is a JSON Schema describing the required output shape - it is NOT " +
            "the output itself. Respond with ONLY a single JSON object that satisfies this " +
            "schema (real data filled in, no markdown code fences, no commentary, and never " +
            "the schema itself): " + JSON.stringify(schema);
          if (requestContents.length === 0) {
            requestContents = [{ role: "user", parts: [{ text: schemaPrompt }] }];
          } else {
            const last = requestContents[requestContents.length - 1];
            requestContents = [
              ...requestContents.slice(0, -1),
              { ...last, parts: [...last.parts, { text: schemaPrompt }] },
            ];
          }
        }

        const model = genAI.getGenerativeModel({
          model: modelId,
          systemInstruction,
          generationConfig,
        });

        const timeoutMs = attempt.withSchema ? structuredAttemptTimeoutMs : chatTimeoutMs;
        const result = await withTimeout(
          model.generateContent({ contents: requestContents }),
          timeoutMs,
          "Gemini request",
        );

        const text = result.response.text();
        if (!text?.trim()) {
          const finishReason = result.response.candidates?.[0]?.finishReason;
          throw new Error(`Empty LLM response (finishReason=${finishReason ?? "unknown"})`);
        }
        try {
          return JSON.parse(text);
        } catch {
          return extractJsonBlock(text);
        }
      } catch (err) {
        lastError = err;
        console.log(`[llm-dev] Gemini (schema=${attempt.withSchema}) failed:`, err);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("LLM_UNAVAILABLE");
  }

  async function extractPdfViaMultimodal(base64Pdf: string): Promise<string> {
    const messages: Array<{ role: string; content: LlmMessageContent }> = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Extract all readable text from this PDF document, preserving section/heading " +
              "structure where possible.",
          },
          { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64Pdf}` } },
        ],
      },
    ];
    const result = (await callGemini(
      messages,
      pdfExtractSchema(),
      pdfExtractMaxTokens,
      undefined,
      geminiPdfModel,
    )) as { extractedText?: string };
    return typeof result.extractedText === "string" ? result.extractedText : "";
  }

  return {
    name: "llm-dev",
    configureServer(server) {
      console.log(
        `[llm-dev] Gemini enabled - model: ${geminiModel}` +
        (geminiApiKey ? "" : " (GEMINI_API_KEY not set)"),
      );

      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
        if (req.method === "GET" && req.url === "/_api/llm-status") {
          const configured = Boolean(geminiApiKey);
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ready: configured,
              primary: { app: "gemini", state: configured ? "ONLINE" : "MISCONFIGURED" },
            }),
          );
          return;
        }
        if (req.method === "POST" && req.url === "/_api/llm-warmup") {
          res.statusCode = 202;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ triggered: false }));
          return;
        }
        if (req.method === "POST" && req.url === "/_api/context-extract") {
          // Phase 1/2 (.txt/.md/.docx) need no Gemini call; Phase 3 (.pdf) routes to Gemini.
          void (async () => {
            const payload = await readJsonBody(req);
            try {
              let text: string;
              if (typeof payload.base64Content === "string") {
                text = await extractPdfViaMultimodal(payload.base64Content);
              } else {
                text = typeof payload.rawText === "string" ? payload.rawText : "";
              }
              const result = applyContextExtractBudget(text, contextExtractCharLimit);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(result));
            } catch (err) {
              console.error("[llm-dev] context-extract (PDF) failed:", err);
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "LLM_UNAVAILABLE" }));
            }
          })();
          return;
        }
        if (
          req.method !== "POST" ||
          (req.url !== "/_api/gap-analysis" && req.url !== "/_api/generate" && req.url !== "/_api/template-extract")
        ) {
          next();
          return;
        }
        const isGapAnalysis = req.url === "/_api/gap-analysis";
        const isTemplateExtract = req.url === "/_api/template-extract";
        void (async () => {
          try {
            const payload = await readJsonBody(req);
            let result: unknown;
            if (isGapAnalysis) {
              const { productTitle, productDetails, selectedTypes, answers } = payload;
              result = await callGemini(
                [
                  { role: "system", content: GAP_ANALYSIS_SYSTEM_PROMPT },
                  {
                    role: "user",
                    content: JSON.stringify({ productTitle, productDetails, selectedTypes, answers }),
                  },
                ],
                gapAnalysisSchema(),
                gapAnalysisMaxTokens,
              );
            } else if (isTemplateExtract) {
              const { docType, rawText } = payload;
              result = await callGemini(
                [
                  { role: "system", content: TEMPLATE_EXTRACT_SYSTEM_PROMPT },
                  { role: "user", content: JSON.stringify({ docType, rawText }) },
                ],
                templateExtractSchema(),
                templateExtractMaxTokens,
              );
            } else {
              const {
                docType,
                productTitle,
                productDetails,
                answers,
                clarifications,
                sections,
                format,
                requirementPhrasing,
                generationMode,
                requirementDepth,
                requirementDecomposition,
                traceability,
                assumptionStrategy,
                complianceFraming,
                outputStructureItems,
                innovationAssistance,
                targetAudience,
                referenceContent,
                priorAttempt,
              } = payload;
              const systemPrompt = buildGenerateSystemPrompt(
                String(docType),
                format as string | undefined,
                requirementPhrasing as string | undefined,
                generationMode as string | undefined,
                requirementDepth as string | undefined,
                requirementDecomposition as string | undefined,
                traceability as TraceabilityFlags | undefined,
                assumptionStrategy as string | undefined,
                complianceFraming as ComplianceFramingFlags | undefined,
                outputStructureItems as string[] | undefined,
                innovationAssistance as string | undefined,
                targetAudience as string | undefined,
                referenceContent as ReferenceContentPayload | undefined,
              );
              const temperature = innovationAssistance
                ? INNOVATION_ASSISTANCE[innovationAssistance as string]?.temperature
                : undefined;
              const priorAttemptContext = buildPriorAttemptBlock(
                priorAttempt as PriorAttemptPayload | undefined,
              );
              result = await callGemini(
                [
                  { role: "system", content: systemPrompt },
                  {
                    role: "user",
                    content: JSON.stringify({
                      productTitle,
                      productDetails,
                      answers,
                      clarifications,
                      sections,
                      ...(priorAttemptContext ? { priorAttemptContext } : {}),
                    }),
                  },
                ],
                generateSchema((sections as string[] | undefined) ?? []),
                generateMaxTokens,
                temperature,
              );
              // The frontend's GenerateResponse contract expects { sections: {...} }, but
              // generateSchema's JSON schema puts section names at the top level.
              result = { sections: result };
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (err) {
            const label = isGapAnalysis ? "gap-analysis" : isTemplateExtract ? "template-extract" : "generate";
            console.error(`[llm-dev] ${label} failed:`, err);
            res.statusCode = 503;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "LLM_UNAVAILABLE" }));
          }
        })();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const backendUrl = env.BACKEND_URL || "http://localhost:5000";

  return {
    base: "./",
    plugins: [react(), createOAuthProxyPlugin(env), createLlmDevPlugin(env)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 3001,
      proxy: {
        "/_api": {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/_api/, ""),
        },
      },
    },
  };
});
