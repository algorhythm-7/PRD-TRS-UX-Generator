import { useEffect, useState, type JSX } from "react";
import type {
  ClarificationQuestion,
  GeneratedDocument,
  GenerationRequest,
  DocType,
} from "./generation/contract";
import { runGapAnalysis, runGeneration, regenerateWithFeedback, type LlmRequestInput } from "./generation/llmGenService";
import { getLlmStatus, triggerLlmWarmup, type PriorAttempt } from "./api/llmClient";
import {
  appendSessionRecord,
  incrementLastSessionThumbsDown,
  setLastSessionEditedSectionCount,
  type SessionRecord,
} from "./generation/sessionMemory";
import { AppShell } from "./app/AppShell";
import { ThemeProvider } from "./theme/ThemeProvider";
import { InputForm } from "./features/input/InputForm";
import { OutputView } from "./features/output/OutputView";
import { ExportControls } from "./features/export/ExportControls";
import { ClarificationQuestions } from "./features/input/ClarificationQuestions";
import {
  GenerationProfileScreen,
  type GenerationProfileScreenValue,
} from "./features/profile/GenerationProfileScreen";

const LLM_STATUS_POLL_MS = 20000;

/** docs/Enhancements4.md §3.2/§11 task 1 - records the configuration used for this generation;
 * edited/thumbs-down counts start at 0 (nothing could have been edited yet) and are updated live
 * as the user interacts with the output (§11 task 2, sessionMemory.ts's `setLastSession*`
 * helpers). Written regardless of LLM vs. deterministic-fallback source - this logs the user's
 * chosen preferences, not whether Calypso was reachable. */
function buildSessionRecord(
  request: GenerationRequest,
  profile: GenerationProfileScreenValue | null,
): SessionRecord {
  const perDocType: SessionRecord["perDocType"] = {};
  for (const docType of request.selectedTypes) {
    const fields = profile?.profile.perDocType[docType];
    if (!fields) continue;
    perDocType[docType] = {
      format: fields.format,
      generationMode: fields.generationMode,
      requirementDepth: fields.requirementDepth,
      requirementDecomposition: fields.requirementDecomposition,
      innovationAssistance: fields.innovationAssistance,
      targetAudience: fields.targetAudience,
      editedSectionCount: 0,
      thumbsDownSectionCount: 0,
    };
  }
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    productTitle: request.productTitle,
    perDocType,
    assumptionStrategy: profile?.profile.assumptionStrategy ?? "balanced",
    traceability: profile?.profile.traceability ?? {
      generateIds: false,
      requirementMapping: false,
      verificationReferences: false,
    },
  };
}

/** Naive split on level-2 ("## ") heading lines, compared by position - same "acceptable
 * fragility, cosmetic count only" trade-off as OutputView's own section parsing
 * (docs/Enhancements2.md §4.5). */
function countEditedSections(original: string, edited: string): number {
  const split = (text: string) => text.split(/\n(?=## )/);
  const originalSections = split(original);
  const editedSections = split(edited);
  let count = 0;
  for (let i = 0; i < Math.max(originalSections.length, editedSections.length); i += 1) {
    if (originalSections[i] !== editedSections[i]) count += 1;
  }
  return count;
}

/** Top-level composition of the SpecPilot app. */
export function App(): JSX.Element {
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [active, setActive] = useState<DocType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clarificationQuestions, setClarificationQuestions] = useState<
    ClarificationQuestion[] | null
  >(null);
  const [pendingRequest, setPendingRequest] = useState<GenerationRequest | null>(null);
  const [llmReady, setLlmReady] = useState(false);
  const [step, setStep] = useState<"input" | "profile">("input");
  const [draftRequest, setDraftRequest] = useState<GenerationRequest | null>(null);
  const [profileValue, setProfileValue] = useState<GenerationProfileScreenValue | null>(null);
  const [lastInput, setLastInput] = useState<LlmRequestInput | null>(null);
  const [regenerateFallbackFor, setRegenerateFallbackFor] = useState<DocType | null>(null);

  // Proactively warm up the primary Calypso model and poll its readiness in the background.
  // Never blocks Generate - the deterministic fallback is always available in the meantime.
  useEffect(() => {
    let cancelled = false;

    void triggerLlmWarmup();

    const poll = async () => {
      const status = await getLlmStatus();
      if (cancelled) return;
      setLlmReady(status.ready);
      if (status.ready) clearInterval(interval);
    };

    void poll();
    const interval = setInterval(() => void poll(), LLM_STATUS_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const finishGeneration = async (
    request: GenerationRequest,
    clarifications: Record<string, string>,
  ) => {
    setPending(true);
    const input: LlmRequestInput = {
      productTitle: request.productTitle,
      productDetails: request.productDetails,
      selectedTypes: request.selectedTypes,
      answers: request.answers,
      clarifications,
      profile: profileValue?.profile,
      outputStructureItems: profileValue?.outputStructureItems,
      referenceContent: profileValue?.referenceContent,
    };
    try {
      const docs = await runGeneration(input);
      setDocuments(docs);
      setContents(Object.fromEntries(docs.map((d) => [d.type, d.content])));
      setActive(docs[0]?.type ?? null);
      setLastInput(input);
      setRegenerateFallbackFor(null);
      // "Use my prior preferences" (docs/Enhancements4.md §3.6/§9) - unchecking opts this
      // generation out of contributing to future pre-fill/consolidation, rather than affecting
      // this screen's own initial values (which are always pre-filled regardless).
      if (profileValue?.usePriorPreferences !== false) {
        appendSessionRecord(buildSessionRecord(request, profileValue));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setPending(false);
      setClarificationQuestions(null);
      setPendingRequest(null);
      setDraftRequest(null);
      setProfileValue(null);
    }
  };

  /** Triggers the existing gap-analysis/clarifications/generation pipeline - previously kicked
   * off directly by InputForm's button, now kicked off by the Generation Profile screen's
   * "Generate" button (docs/EnhancementToDo3.md §9), after InputForm's "Continue" button. */
  const startGeneration = async (request: GenerationRequest) => {
    setPending(true);
    setError(null);
    setClarificationQuestions(null);
    try {
      const questions = await runGapAnalysis({
        productTitle: request.productTitle,
        productDetails: request.productDetails,
        selectedTypes: request.selectedTypes,
        answers: request.answers,
      });
      if (questions.length > 0) {
        setPendingRequest(request);
        setClarificationQuestions(questions);
        setPending(false);
        return;
      }
      await finishGeneration(request, {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
      setPending(false);
    }
  };

  const onContinue = (request: GenerationRequest) => {
    setError(null);
    setDraftRequest(request);
    setStep("profile");
  };

  const onProfileGenerate = () => {
    if (!draftRequest) return;
    setStep("input");
    void startGeneration(draftRequest);
  };

  const onClarificationsSubmit = (clarifications: Record<string, string>) => {
    if (pendingRequest) void finishGeneration(pendingRequest, clarifications);
  };

  const onClarificationsSkip = () => {
    if (pendingRequest) void finishGeneration(pendingRequest, {});
  };

  const onContentChange = (type: DocType, content: string) => {
    setContents((current) => ({ ...current, [type]: content }));
    const original = documents.find((d) => d.type === type)?.content;
    if (original !== undefined) {
      setLastSessionEditedSectionCount(type, countEditedSections(original, content));
    }
  };

  const onSectionThumbsDown = (type: DocType) => {
    incrementLastSessionThumbsDown(type);
  };

  /** docs/Enhancements2.md §4 - reuses the input from the last successful generation so a single
   * DocType can be regenerated with the user's edits as feedback. */
  const onRegenerate = (type: DocType, priorAttempt: PriorAttempt) => {
    if (!lastInput) return;
    setPending(true);
    setError(null);
    void regenerateWithFeedback(type, lastInput, priorAttempt).then((doc) => {
      setDocuments((current) => current.map((d) => (d.type === type ? doc : d)));
      setContents((current) => ({ ...current, [type]: doc.content }));
      // docs/Enhancements2.md §4.6 - deterministic fallback can't honor priorAttempt, so this
      // must be surfaced distinctly rather than silently presenting it as feedback-applied.
      setRegenerateFallbackFor(doc.source === "fallback" ? type : null);
      setPending(false);
    });
  };

  const activeDoc = documents.find((d) => d.type === active) ?? documents[0];
  const activeContent = activeDoc ? contents[activeDoc.type] ?? activeDoc.content : "";

  return (
    <ThemeProvider>
      <AppShell>
        {!llmReady && (
          <p className="alert alert--info" role="status">
            The AI model is warming up (first use after a period of inactivity can take a few
            minutes) - document generation will use the offline fallback until it&apos;s ready.
          </p>
        )}
        <InputForm onContinue={onContinue} pending={pending} />
        {step === "profile" && draftRequest && (
          <GenerationProfileScreen
            selectedTypes={draftRequest.selectedTypes}
            onChange={setProfileValue}
            onGenerate={onProfileGenerate}
            pending={pending}
          />
        )}
        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}
        {clarificationQuestions && clarificationQuestions.length > 0 && (
          <ClarificationQuestions
            questions={clarificationQuestions}
            onSubmit={onClarificationsSubmit}
            onSkip={onClarificationsSkip}
            pending={pending}
          />
        )}
        <OutputView
          documents={documents}
          onContentChange={onContentChange}
          onActiveChange={setActive}
          onRegenerate={onRegenerate}
          onSectionThumbsDown={onSectionThumbsDown}
          pending={pending}
          regenerateFallbackFor={regenerateFallbackFor}
        />
        {activeDoc?.source === "fallback" && (
          <p className="alert alert--info" role="status">
            Generated using the offline fallback (AI service unavailable).
          </p>
        )}
        {activeDoc && (
          <ExportControls
            productTitle={activeDoc.title}
            docType={activeDoc.type}
            content={activeContent}
          />
        )}
      </AppShell>
    </ThemeProvider>
  );
}
