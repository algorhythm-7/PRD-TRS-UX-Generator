import { useEffect, useState, type JSX } from "react";
import {
  ASSUMPTION_STRATEGIES,
  FORMAT_APPLICABILITY,
  GENERATION_MODES,
  INNOVATION_ASSISTANCE_LEVELS,
  OUTPUT_STRUCTURE_APPLICABILITY,
  OUTPUT_STRUCTURE_EQUIVALENTS,
  OUTPUT_STRUCTURE_ITEMS,
  REQUIREMENT_DECOMPOSITION_LEVELS,
  REQUIREMENT_DEPTH_LEVELS,
  TARGET_AUDIENCES,
  type AssumptionStrategy,
  type DocType,
  type DocumentFormatId,
  type GenerationProfile,
  type OutputStructureItem,
  type PerDocTypeProfile,
} from "../../generation/contract";
import {
  postContextExtract,
  postContextExtractBinary,
  postTemplateExtract,
  type ReferenceContent,
} from "../../api/llmClient";
import { sectionNamesFor } from "../../generation/sectionSchema";
import { FORMAT_EXAMPLES } from "../../generation/formatExamples";
import * as mammoth from "mammoth";
import {
  consolidateAssumptionStrategy,
  consolidatePerDocTypeField,
  consolidateTraceabilityFlag,
  loadSessionMemoryStore,
  type SessionRecord,
} from "../../generation/sessionMemory";

/** docs/Enhancements3.md §5 - each DocType's documented default audience, matching its existing
 * Standard-format assumed audience exactly. */
const TARGET_AUDIENCE_DEFAULT: Record<DocType, (typeof TARGET_AUDIENCES)[number]> = {
  PRD: "product",
  TRS: "engineering",
  UX: "product",
};

/** docs/Enhancements3.md §3.2 - each DocType's default Generation Mode ("the default,
 * standard-format tone" per docs/Enhancements3.md's own wording for these 3 values). */
const GENERATION_MODE_DEFAULT: Record<DocType, string> = {
  PRD: "product_management",
  TRS: "strict_trs",
  UX: "user_journey",
};

function defaultPerDocTypeProfile(docType: DocType): PerDocTypeProfile {
  return {
    format: "standard",
    generationMode: GENERATION_MODE_DEFAULT[docType],
    requirementDepth: "standard_engineering",
    requirementDecomposition: "functional_requirement",
    innovationAssistance: "disabled",
    targetAudience: TARGET_AUDIENCE_DEFAULT[docType],
  };
}

type PerDocTypeConflicts = Partial<Record<keyof PerDocTypeProfile, boolean>>;

/** docs/Enhancements4.md §3.6 - pre-fills from session memory's consolidated preferences instead
 * of the hard-coded defaults, only for fields with at least one prior session; a first-time
 * browser (no sessions) reproduces exactly today's hard-coded defaults. */
function buildPerDocTypeProfile(
  sessions: SessionRecord[],
  docType: DocType,
): { profile: PerDocTypeProfile; conflicts: PerDocTypeConflicts } {
  const base = defaultPerDocTypeProfile(docType);
  const format = consolidatePerDocTypeField(sessions, docType, "format");
  const generationMode = consolidatePerDocTypeField(sessions, docType, "generationMode");
  const requirementDepth = consolidatePerDocTypeField(sessions, docType, "requirementDepth");
  const requirementDecomposition = consolidatePerDocTypeField(sessions, docType, "requirementDecomposition");
  const innovationAssistance = consolidatePerDocTypeField(sessions, docType, "innovationAssistance");
  const targetAudience = consolidatePerDocTypeField(sessions, docType, "targetAudience");
  return {
    profile: {
      format: format?.value ?? base.format,
      generationMode: generationMode?.value ?? base.generationMode,
      requirementDepth: requirementDepth?.value ?? base.requirementDepth,
      requirementDecomposition: requirementDecomposition?.value ?? base.requirementDecomposition,
      innovationAssistance: innovationAssistance?.value ?? base.innovationAssistance,
      targetAudience: targetAudience?.value ?? base.targetAudience,
    },
    conflicts: {
      format: format?.conflict ?? false,
      generationMode: generationMode?.conflict ?? false,
      requirementDepth: requirementDepth?.conflict ?? false,
      requirementDecomposition: requirementDecomposition?.conflict ?? false,
      innovationAssistance: innovationAssistance?.conflict ?? false,
      targetAudience: targetAudience?.conflict ?? false,
    },
  };
}

/** "pr_faq" -> "Pr Faq", "standard" -> "Standard" - good enough for every current control value
 * (none need bespoke display copy beyond title-casing). */
function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Short, single-line preview for upload-confirmation messages (Context Sources) - mirrors the
 * Custom Template upload's existing "Extracted sections: ..." confirmation pattern, which these
 * two uploads previously had no equivalent of. */
function previewText(text: string, maxLength = 80): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

/** docs/Enhancements4.md §4.1 Phase 2 - .docx is parsed client-side (no server round-trip, no
 * LLM token spend, per the plan's own reasoning); every other supported type is already
 * plain text read via `File.text()` (Phase 1). */
async function readFileAsText(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith(".docx")) {
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return value;
  }
  return file.text();
}

/** docs/Enhancements4.md §4.1 Phase 3 - .pdf is sent to the server as base64 for Gemini
 * OCR/multimodal extraction, since it isn't plain text and can't be parsed client-side. */
async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** docs/Enhancements4.md §3.4 - non-blocking transparency cue; the highest-scoring value is
 * still applied either way. */
function ConflictNote({ show }: { show: boolean }): JSX.Element | null {
  if (!show) return null;
  return <p className="alert alert--info">Your past choices for this were mixed - showing our best guess.</p>;
}

export interface GenerationProfileScreenValue {
  profile: GenerationProfile;
  outputStructureItems: Partial<Record<DocType, string[]>>;
  referenceContent?: ReferenceContent;
  /** Whether to pre-fill from session memory (docs/Enhancements4.md §3.6) - this screen already
   * pre-fills using it; unchecking opts this generation's own session record out of being
   * written to `localStorage` (App.tsx's `finishGeneration`), so it won't influence future
   * pre-fill/consolidation - it never affects this screen's own initial values. */
  usePriorPreferences: boolean;
}

export interface GenerationProfileScreenProps {
  selectedTypes: DocType[];
  /** Called whenever any field changes, so the "Generate" button below can read the latest value
   * without this component needing to know about submission. */
  onChange: (value: GenerationProfileScreenValue) => void;
  onGenerate: () => void;
  pending?: boolean;
}

/** Generation Profile screen (docs/Enhancements3.md §2, docs/Enhancements4.md §5) - not yet wired
 * into App.tsx (docs/EnhancementToDo3.md §9). Implements §8 tasks 1-6: per-DocType sub-panel,
 * shared panel, Context Sources panel, Output Structure checkboxes, session-memory pre-fill, and
 * the Generate button/pending state. Component tests (task 7) are separate, not yet built. */
export function GenerationProfileScreen({
  selectedTypes,
  onChange,
  onGenerate,
  pending,
}: GenerationProfileScreenProps): JSX.Element {
  const [sessionMemory] = useState(() => loadSessionMemoryStore().sessions);
  const [preFill] = useState(() => {
    const perDocTypeResult: Partial<Record<DocType, PerDocTypeProfile>> = {};
    const perDocTypeConflicts: Partial<Record<DocType, PerDocTypeConflicts>> = {};
    for (const docType of selectedTypes) {
      const built = buildPerDocTypeProfile(sessionMemory, docType);
      perDocTypeResult[docType] = built.profile;
      perDocTypeConflicts[docType] = built.conflicts;
    }
    const assumption = consolidateAssumptionStrategy(sessionMemory);
    const generateIds = consolidateTraceabilityFlag(sessionMemory, "generateIds");
    const requirementMapping = consolidateTraceabilityFlag(sessionMemory, "requirementMapping");
    const verificationReferences = consolidateTraceabilityFlag(sessionMemory, "verificationReferences");
    return {
      perDocType: perDocTypeResult,
      perDocTypeConflicts,
      assumptionStrategy: assumption?.value ?? ("balanced" as AssumptionStrategy),
      assumptionStrategyConflict: assumption?.conflict ?? false,
      traceability: {
        generateIds: generateIds?.value ?? false,
        requirementMapping: requirementMapping?.value ?? false,
        verificationReferences: verificationReferences?.value ?? false,
      },
      traceabilityConflicts: {
        generateIds: generateIds?.conflict ?? false,
        requirementMapping: requirementMapping?.conflict ?? false,
        verificationReferences: verificationReferences?.conflict ?? false,
      },
    };
  });

  const [perDocType, setPerDocType] = useState<Partial<Record<DocType, PerDocTypeProfile>>>(
    () => preFill.perDocType,
  );
  const [outputStructureItems, setOutputStructureItems] = useState<Partial<Record<DocType, string[]>>>({});
  const [traceability, setTraceability] = useState(() => preFill.traceability);
  const [assumptionStrategy, setAssumptionStrategy] = useState<AssumptionStrategy>(
    () => preFill.assumptionStrategy,
  );
  const [complianceFraming, setComplianceFraming] = useState({ aspice: false, iso26262: false });

  const [usePriorPreferences, setUsePriorPreferences] = useState(true);
  const [useReferenceDocuments, setUseReferenceDocuments] = useState(false);
  const [referenceDocuments, setReferenceDocuments] = useState<string[]>([]);
  const [styleExample, setStyleExample] = useState<string | undefined>(undefined);
  const [contextError, setContextError] = useState<string | undefined>(undefined);
  /** Which Template option is currently hovered/focused per DocType, for the format preview
   * below the radiogroup (docs/Enhancements2.md §3.6's originally-deferred hover/focus preview). */
  const [previewFormat, setPreviewFormat] = useState<Partial<Record<DocType, DocumentFormatId>>>({});

  useEffect(() => {
    const referenceContent: ReferenceContent | undefined =
      useReferenceDocuments && (referenceDocuments.length > 0 || styleExample)
        ? { documents: referenceDocuments.length > 0 ? referenceDocuments : undefined, styleExample }
        : undefined;
    onChange({
      profile: { perDocType, traceability, assumptionStrategy, complianceFraming },
      outputStructureItems,
      referenceContent,
      usePriorPreferences,
    });
    // onChange is expected to be stable (or the caller's problem if not) - re-running on every
    // render would be wasteful and isn't needed since these are the only inputs that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    perDocType,
    outputStructureItems,
    traceability,
    assumptionStrategy,
    complianceFraming,
    usePriorPreferences,
    useReferenceDocuments,
    referenceDocuments,
    styleExample,
  ]);

  function toggleOutputStructureItem(docType: DocType, item: OutputStructureItem, checked: boolean) {
    setOutputStructureItems((current) => {
      const existing = current[docType] ?? [];
      const next = checked ? [...existing, item] : existing.filter((name) => name !== item);
      return { ...current, [docType]: next };
    });
  }

  function updatePerDocType(docType: DocType, patch: Partial<PerDocTypeProfile>) {
    setPerDocType((current) => ({
      ...current,
      [docType]: { ...(current[docType] ?? defaultPerDocTypeProfile(docType)), ...patch },
    }));
  }

  /** docs/Enhancements4.md §4.1 Phase 2 - .docx is parsed client-side (no server round-trip, no
   * LLM token spend, per the plan's own reasoning); every other supported type is already
   * plain text read via `File.text()` (Phase 1). */
  async function handleCustomTemplateUpload(docType: DocType, file: File) {
    try {
      const rawText = await readFileAsText(file);
      const { sections } = await postTemplateExtract(docType, rawText);
      updatePerDocType(docType, { format: "custom", customTemplateSections: sections });
    } catch {
      setContextError("Couldn't read your template - try again or use a Standard format.");
    }
  }

  /** docs/Enhancements4.md §4.1 Phase 3 - .pdf is routed server-side to Gemini multimodal
   * model via `postContextExtractBinary`, since it can't be read as plain text client-side. */
  async function extractTextFromUpload(file: File): Promise<string> {
    if (file.name.toLowerCase().endsWith(".pdf")) {
      const base64Content = await fileToBase64(file);
      const { extractedText } = await postContextExtractBinary(file.name, base64Content);
      return extractedText;
    }
    const rawText = await readFileAsText(file);
    const { extractedText } = await postContextExtract(file.name, rawText);
    return extractedText;
  }

  async function handleReferenceDocumentUpload(file: File) {
    try {
      const extractedText = await extractTextFromUpload(file);
      setReferenceDocuments((current) => [...current, extractedText].slice(-3));
      setContextError(undefined);
    } catch {
      setContextError(`Couldn't read ${file.name} - try again.`);
    }
  }

  async function handleStyleExampleUpload(file: File) {
    try {
      const extractedText = await extractTextFromUpload(file);
      setStyleExample(extractedText);
      setContextError(undefined);
    } catch {
      setContextError(`Couldn't read ${file.name} - try again.`);
    }
  }

  return (
    <section className="card" aria-label="Generation profile">
      {selectedTypes.map((docType) => {
        const current = perDocType[docType] ?? defaultPerDocTypeProfile(docType);
        const conflicts = preFill.perDocTypeConflicts[docType] ?? {};
        const existingSections = sectionNamesFor(docType, current.format, current.customTemplateSections);
        return (
          <div className="card" key={docType} aria-label={`${docType} generation profile`}>
            <h3 className="card__title">{docType}</h3>

            <fieldset className="field-group" role="radiogroup" aria-label={`${docType} Template`}>
              <legend className="field-group__legend">Template</legend>
              <div className="field-group--options">
                {[...FORMAT_APPLICABILITY[docType]].map((format) => (
                  <label
                    className="checkbox"
                    key={format}
                    onMouseEnter={() => setPreviewFormat((c) => ({ ...c, [docType]: format }))}
                    onMouseLeave={() =>
                      setPreviewFormat((c) => (c[docType] === format ? { ...c, [docType]: undefined } : c))
                    }
                    onFocus={() => setPreviewFormat((c) => ({ ...c, [docType]: format }))}
                    onBlur={() =>
                      setPreviewFormat((c) => (c[docType] === format ? { ...c, [docType]: undefined } : c))
                    }
                  >
                    <input
                      type="radio"
                      name={`${docType}-format`}
                      aria-label={`${docType} Template ${humanize(format)}`}
                      checked={current.format === format}
                      onChange={() => updatePerDocType(docType, { format })}
                    />
                    {format === "standard" ? "Standard" : humanize(format)}
                  </label>
                ))}
              </div>
              {previewFormat[docType] && FORMAT_EXAMPLES[docType]?.[previewFormat[docType]!] && (
                <div
                  className="format-preview"
                  role="note"
                  aria-label={`${docType} Template ${humanize(previewFormat[docType]!)} preview`}
                >
                  <p className="format-preview__description">
                    {FORMAT_EXAMPLES[docType]![previewFormat[docType]!]!.description}
                  </p>
                  <pre className="format-preview__example">
                    {FORMAT_EXAMPLES[docType]![previewFormat[docType]!]!.preview}
                  </pre>
                </div>
              )}
              {current.format === "custom" && (
                <label className="field">
                  Upload a .txt, .md, or .docx file to extract its structure
                  <input
                    type="file"
                    accept=".txt,.md,.docx"
                    aria-label={`${docType} custom template upload`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleCustomTemplateUpload(docType, file);
                    }}
                  />
                </label>
              )}
              {current.format === "custom" && current.customTemplateSections && (
                <p className="alert alert--info">
                  Extracted sections: {current.customTemplateSections.join(", ")}
                </p>
              )}
              <ConflictNote show={conflicts.format ?? false} />
            </fieldset>

            <fieldset className="field-group" role="radiogroup" aria-label={`${docType} Generation Mode`}>
              <legend className="field-group__legend">Generation Mode</legend>
              <div className="field-group--options">
                {GENERATION_MODES[docType].map((mode) => (
                  <label className="checkbox" key={mode}>
                    <input
                      type="radio"
                      name={`${docType}-generationMode`}
                      aria-label={`${docType} Generation Mode ${humanize(mode)}`}
                      checked={current.generationMode === mode}
                      onChange={() => updatePerDocType(docType, { generationMode: mode })}
                    />
                    {humanize(mode)}
                  </label>
                ))}
              </div>
              <ConflictNote show={conflicts.generationMode ?? false} />
            </fieldset>

            <fieldset className="field-group" role="radiogroup" aria-label={`${docType} Requirement Depth`}>
              <legend className="field-group__legend">Requirement Depth</legend>
              <div className="field-group--options">
                {REQUIREMENT_DEPTH_LEVELS.map((level) => (
                  <label className="checkbox" key={level}>
                    <input
                      type="radio"
                      name={`${docType}-requirementDepth`}
                      aria-label={`${docType} Requirement Depth ${humanize(level)}`}
                      checked={current.requirementDepth === level}
                      onChange={() => updatePerDocType(docType, { requirementDepth: level })}
                    />
                    {humanize(level)}
                  </label>
                ))}
              </div>
              <ConflictNote show={conflicts.requirementDepth ?? false} />
            </fieldset>

            <fieldset className="field-group" role="radiogroup" aria-label={`${docType} Requirement Decomposition`}>
              <legend className="field-group__legend">Requirement Decomposition</legend>
              <div className="field-group--options">
                {REQUIREMENT_DECOMPOSITION_LEVELS.map((level) => (
                  <label className="checkbox" key={level}>
                    <input
                      type="radio"
                      name={`${docType}-requirementDecomposition`}
                      aria-label={`${docType} Requirement Decomposition ${humanize(level)}`}
                      checked={current.requirementDecomposition === level}
                      onChange={() => updatePerDocType(docType, { requirementDecomposition: level })}
                    />
                    {humanize(level)}
                  </label>
                ))}
              </div>
              <ConflictNote show={conflicts.requirementDecomposition ?? false} />
            </fieldset>

            <fieldset className="field-group" role="radiogroup" aria-label={`${docType} Innovation Assistance`}>
              <legend className="field-group__legend">Innovation Assistance</legend>
              <div className="field-group--options">
                {INNOVATION_ASSISTANCE_LEVELS.map((level) => (
                  <label className="checkbox" key={level}>
                    <input
                      type="radio"
                      name={`${docType}-innovationAssistance`}
                      aria-label={`${docType} Innovation Assistance ${humanize(level)}`}
                      checked={current.innovationAssistance === level}
                      onChange={() => updatePerDocType(docType, { innovationAssistance: level })}
                    />
                    {humanize(level)}
                  </label>
                ))}
              </div>
              <ConflictNote show={conflicts.innovationAssistance ?? false} />
            </fieldset>

            <fieldset className="field-group" role="radiogroup" aria-label={`${docType} Target Audience`}>
              <legend className="field-group__legend">Target Audience</legend>
              <div className="field-group--options">
                {TARGET_AUDIENCES.map((audience) => (
                  <label className="checkbox" key={audience}>
                    <input
                      type="radio"
                      name={`${docType}-targetAudience`}
                      aria-label={`${docType} Target Audience ${humanize(audience)}`}
                      checked={current.targetAudience === audience}
                      onChange={() => updatePerDocType(docType, { targetAudience: audience })}
                    />
                    {humanize(audience)}
                  </label>
                ))}
              </div>
              <ConflictNote show={conflicts.targetAudience ?? false} />
            </fieldset>

            <fieldset className="field-group" aria-label={`${docType} Output Structure`}>
              <legend className="field-group__legend">Output Structure</legend>
              <div className="field-group--options">
                {OUTPUT_STRUCTURE_ITEMS.filter((item) => OUTPUT_STRUCTURE_APPLICABILITY[item].includes(docType)).map(
                  (item) => {
                    const equivalent = OUTPUT_STRUCTURE_EQUIVALENTS[item].find((name) =>
                      existingSections.includes(name),
                    );
                    const checked = outputStructureItems[docType]?.includes(item) ?? false;
                    return (
                      <label
                        className="checkbox"
                        key={item}
                        title={equivalent ? `Already included as "${equivalent}" in the selected Template` : undefined}
                      >
                        <input
                          type="checkbox"
                          aria-label={`${docType} Output Structure ${item}`}
                          checked={checked}
                          disabled={Boolean(equivalent)}
                          onChange={(e) => toggleOutputStructureItem(docType, item, e.target.checked)}
                        />
                        {item}
                      </label>
                    );
                  },
                )}
              </div>
            </fieldset>
          </div>
        );
      })}

      {/* Traceability guidance only exists for PRD/TRS (server.mjs's TRACEABILITY_*_GUIDANCE has
       * no UX entry) - hidden entirely when neither is selected so it never silently does
       * nothing for a UX-only batch. */}
      {selectedTypes.some((type) => type === "PRD" || type === "TRS") && (
        <fieldset className="field-group" aria-label="Traceability">
          <legend className="field-group__legend">Traceability</legend>
          <div className="field-group--options">
            <label className="checkbox">
              <input
                type="checkbox"
                aria-label="Generate requirement IDs"
                checked={traceability.generateIds}
                onChange={(e) => setTraceability((c) => ({ ...c, generateIds: e.target.checked }))}
              />
              Generate requirement IDs
            </label>
            <label
              className="checkbox"
              title={
                traceability.generateIds ? undefined : "Only applies when \"Generate requirement IDs\" is also enabled"
              }
            >
              <input
                type="checkbox"
                aria-label="CRS to TRS mapping"
                checked={traceability.requirementMapping}
                disabled={!traceability.generateIds}
                onChange={(e) => setTraceability((c) => ({ ...c, requirementMapping: e.target.checked }))}
              />
              CRS → TRS mapping
            </label>
            <label
              className="checkbox"
              title={
                traceability.generateIds ? undefined : "Only applies when \"Generate requirement IDs\" is also enabled"
              }
            >
              <input
                type="checkbox"
                aria-label="Verification references"
                checked={traceability.verificationReferences}
                disabled={!traceability.generateIds}
                onChange={(e) => setTraceability((c) => ({ ...c, verificationReferences: e.target.checked }))}
              />
              Verification references
            </label>
          </div>
          <ConflictNote
            show={
              preFill.traceabilityConflicts.generateIds ||
              preFill.traceabilityConflicts.requirementMapping ||
              preFill.traceabilityConflicts.verificationReferences
            }
          />
        </fieldset>
      )}

      <fieldset className="field-group" role="radiogroup" aria-label="Assumption Strategy">
        <legend className="field-group__legend">Assumption Strategy</legend>
        <div className="field-group--options">
          {ASSUMPTION_STRATEGIES.map((strategy) => (
            <label className="checkbox" key={strategy}>
              <input
                type="radio"
                name="assumptionStrategy"
                aria-label={`Assumption Strategy ${humanize(strategy)}`}
                checked={assumptionStrategy === strategy}
                onChange={() => setAssumptionStrategy(strategy)}
              />
              {humanize(strategy)}
            </label>
          ))}
        </div>
        <ConflictNote show={preFill.assumptionStrategyConflict} />
      </fieldset>

      <fieldset className="field-group" aria-label="Compliance Framing">
        <legend className="field-group__legend">Compliance Framing</legend>
        <div className="field-group--options">
          <label className="checkbox">
            <input
              type="checkbox"
              aria-label="ASPICE"
              checked={complianceFraming.aspice}
              onChange={(e) => setComplianceFraming((c) => ({ ...c, aspice: e.target.checked }))}
            />
            ASPICE
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              aria-label="ISO 26262"
              checked={complianceFraming.iso26262}
              onChange={(e) => setComplianceFraming((c) => ({ ...c, iso26262: e.target.checked }))}
            />
            ISO 26262
          </label>
        </div>
      </fieldset>

      <fieldset className="field-group" aria-label="Context Sources">
        <legend className="field-group__legend">Context Sources</legend>
        <div className="field-group--options">
          <label className="checkbox">
            <input
              type="checkbox"
              aria-label="Use uploaded reference documents"
              checked={useReferenceDocuments}
              onChange={(e) => setUseReferenceDocuments(e.target.checked)}
            />
            Use uploaded reference documents
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              aria-label="Use my prior preferences (this browser)"
              checked={usePriorPreferences}
              onChange={(e) => setUsePriorPreferences(e.target.checked)}
            />
            Use my prior preferences (this browser)
          </label>
          <label className="checkbox" title="Requires an approved web search provider - not yet available">
            <input type="checkbox" aria-label="Include web search results" checked={false} disabled readOnly />
            Include web search results
          </label>
        </div>

        {useReferenceDocuments && (
          <label className="field">
            Reference documents (up to 3, .txt/.md/.docx/.pdf)
            <input
              type="file"
              accept=".txt,.md,.docx,.pdf"
              aria-label="Reference document upload"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleReferenceDocumentUpload(file);
              }}
            />
          </label>
        )}
        {useReferenceDocuments && referenceDocuments.length > 0 && (
          <div className="alert alert--info" role="status">
            <p>
              {referenceDocuments.length} of 3 reference document{referenceDocuments.length === 1 ? "" : "s"} added:
            </p>
            <ul>
              {referenceDocuments.map((doc, index) => (
                // eslint-disable-next-line react/no-array-index-key -- documents aren't individually removable/reordered, only appended/capped
                <li key={index}>{previewText(doc)}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="field">
          Style example (upload a previously generated document)
          <input
            type="file"
            accept=".txt,.md,.docx,.pdf"
            aria-label="Style example upload"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleStyleExampleUpload(file);
            }}
          />
        </label>
        {styleExample && (
          <p className="alert alert--info" role="status">
            Style example added: "{previewText(styleExample)}"
          </p>
        )}

        {contextError && (
          <p className="alert alert--error" role="alert">
            {contextError}
          </p>
        )}
      </fieldset>

      <button className="btn btn--primary" type="button" onClick={onGenerate} disabled={pending}>
        {pending ? "Generating…" : "Generate"}
      </button>
    </section>
  );
}
