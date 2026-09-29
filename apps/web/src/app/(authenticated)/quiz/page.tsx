"use client";

import { useState, type ReactElement } from "react";
import type {
  PaperId,
  QuizAttemptDto,
  QuizResultDto,
  QuizScope,
  SectionId,
} from "@uptet/contracts";
import { startQuizAttempt, submitQuizAttempt } from "@/lib/apiClient";

/**
 * Feature 001 (docs/features/001-quiz-and-score-prediction.md). Real
 * design pass over the previously-unstyled version — colors, type and
 * card/row/button patterns ported from the Claude Design canvas
 * prototype (tailwind.config.ts's file comment has the full story). The
 * data flow is UNCHANGED from the placeholder version: same three-phase
 * state machine (config/taking/result), same API calls, same real EAP
 * scoring from the server — this is a styling pass, not a behavior
 * change. The prototype's separate "confirm" and "review grid" screens
 * were deliberately left out of this pass to keep it scoped to what
 * users actually need for a first real test (see chat history); they
 * can be added later without touching the data flow below.
 *
 * All questions for an attempt arrive from the server in one response
 * (QuizAttemptDto.questions — see packages/contracts/src/quiz.ts); "one
 * question at a time" per the acceptance criteria is purely a client-side
 * presentation choice over that already-fetched list, not a paginated
 * per-question API. Everything the user answers is submitted together in
 * one POST /api/v1/quiz-attempts/submit call when they finish.
 */

// Mirrors apps/web/src/server/modules/quiz/paperSections.ts. Duplicated
// here on purpose — it's client-facing display/filtering logic, not the
// server's quiz-composition rule, and paperSections.ts is intentionally
// server-only (see its own file comment).
const SECTIONS_BY_PAPER: Record<PaperId, SectionId[]> = {
  paper_1: [
    "child_development_pedagogy",
    "language_1_hindi",
    "language_2_english",
    "mathematics",
    "evs",
  ],
  paper_2: [
    "child_development_pedagogy",
    "language_1_hindi",
    "language_2_english",
    "social_studies",
  ],
};

const SECTION_LABELS: Record<SectionId, string> = {
  child_development_pedagogy: "Child Development & Pedagogy",
  language_1_hindi: "Language I (Hindi)",
  language_2_english: "Language II (English)",
  mathematics: "Mathematics",
  evs: "Environmental Studies",
  social_studies: "Social Studies",
};

const LABEL_TEXT: Record<string, string> = {
  strong: "Strong",
  developing: "Developing",
  needs_work: "Needs work",
};

const LABEL_PILL_CLASSES: Record<string, string> = {
  strong: "bg-status-strongBg text-status-strongText",
  developing: "bg-status-developingBg text-status-developingText",
  needs_work: "bg-status-needsWorkBg text-status-needsWorkText",
};

const LABEL_BAR_CLASSES: Record<string, string> = {
  strong: "bg-status-strong",
  developing: "bg-status-developing",
  needs_work: "bg-status-needsWork",
};

type Phase = "config" | "taking" | "result";

const OPTION_LETTERS = ["A", "B", "C", "D"];

export default function QuizPage(): ReactElement {
  const [phase, setPhase] = useState<Phase>("config");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Config form state
  const [paperId, setPaperId] = useState<PaperId>("paper_1");
  const [scope, setScope] = useState<QuizScope>("full_mock");
  const [sectionId, setSectionId] = useState<SectionId>(
    SECTIONS_BY_PAPER.paper_1[0],
  );

  // Taking-phase state
  const [attempt, setAttempt] = useState<QuizAttemptDto | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, number>>({});

  // Result-phase state
  const [result, setResult] = useState<QuizResultDto | null>(null);

  function handlePaperChange(next: PaperId) {
    setPaperId(next);
    setSectionId(SECTIONS_BY_PAPER[next][0]);
  }

  async function handleStart() {
    setError(null);
    setIsBusy(true);
    try {
      const started = await startQuizAttempt({
        paperId,
        scope,
        sectionId: scope === "section_practice" ? sectionId : undefined,
      });
      setAttempt(started);
      setCurrentIndex(0);
      setResponses({});
      setPhase("taking");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the quiz.");
    } finally {
      setIsBusy(false);
    }
  }

  function selectOption(questionId: string, optionIndex: number) {
    setResponses((prev) => ({ ...prev, [questionId]: optionIndex }));
  }

  async function handleSubmit() {
    if (!attempt) return;
    setError(null);
    setIsBusy(true);
    try {
      const submitted = await submitQuizAttempt({
        attemptId: attempt.id,
        responses: Object.entries(responses).map(([questionId, selectedOptionIndex]) => ({
          questionId,
          selectedOptionIndex,
        })),
      });
      setResult(submitted);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit the quiz.");
    } finally {
      setIsBusy(false);
    }
  }

  function resetToConfig() {
    setAttempt(null);
    setResult(null);
    setResponses({});
    setCurrentIndex(0);
    setError(null);
    setPhase("config");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md">
      {error ? (
        <div className="mx-7 mt-6 rounded-row border border-status-needsWork/40 bg-status-needsWorkBg p-3 text-sm text-status-needsWorkText">
          {error}
        </div>
      ) : null}

      {phase === "config" ? (
        <QuizConfig
          paperId={paperId}
          scope={scope}
          sectionId={sectionId}
          isBusy={isBusy}
          onPaperChange={handlePaperChange}
          onScopeChange={setScope}
          onSectionChange={setSectionId}
          onStart={handleStart}
        />
      ) : null}

      {phase === "taking" && attempt ? (
        <QuizTaking
          attempt={attempt}
          currentIndex={currentIndex}
          responses={responses}
          isBusy={isBusy}
          onSelectOption={selectOption}
          onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onNext={() =>
            setCurrentIndex((i) => Math.min(attempt.questions.length - 1, i + 1))
          }
          onSubmit={handleSubmit}
        />
      ) : null}

      {phase === "result" && result ? (
        <QuizResultView result={result} onRestart={resetToConfig} />
      ) : null}
    </main>
  );
}

function QuizConfig({
  paperId,
  scope,
  sectionId,
  isBusy,
  onPaperChange,
  onScopeChange,
  onSectionChange,
  onStart,
}: {
  paperId: PaperId;
  scope: QuizScope;
  sectionId: SectionId;
  isBusy: boolean;
  onPaperChange: (next: PaperId) => void;
  onScopeChange: (next: QuizScope) => void;
  onSectionChange: (next: SectionId) => void;
  onStart: () => void;
}): ReactElement {
  return (
    <div className="flex flex-col gap-9 px-7 pb-32 pt-9">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
          UPTET Prep
        </div>
        <h1 className="mt-3 font-serif text-[32px] font-semibold leading-tight tracking-tight">
          Practice quiz
        </h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-muted">
          Pick a paper and quiz type to begin.
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-faint">
          Paper
        </span>
        <div className="flex gap-3">
          {(
            [
              { id: "paper_1" as const, label: "Paper 1", sub: "Primary (Classes I–V)" },
              { id: "paper_2" as const, label: "Paper 2", sub: "Upper Primary (VI–VIII)" },
            ]
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === paperId}
              onClick={() => onPaperChange(p.id)}
              className={`flex-1 rounded-row border p-4 text-left shadow-sm transition-colors ${
                p.id === paperId
                  ? "border-accent bg-accent-tint"
                  : "border-border bg-card"
              }`}
            >
              <span className="block text-[14.5px] font-semibold">{p.label}</span>
              <span className="mt-1 block text-xs text-ink-muted">{p.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-faint">
          Quiz type
        </span>
        <div className="flex flex-col gap-3">
          {(
            [
              { id: "full_mock" as const, label: "Full mock paper", sub: "All sections, real exam order" },
              { id: "section_practice" as const, label: "Section practice", sub: "Focus on just one section" },
            ]
          ).map((q) => (
            <button
              key={q.id}
              type="button"
              aria-pressed={q.id === scope}
              onClick={() => onScopeChange(q.id)}
              className={`flex items-center justify-between rounded-row border p-4 text-left shadow-sm transition-colors ${
                q.id === scope ? "border-accent bg-accent-tint" : "border-border bg-card"
              }`}
            >
              <span>
                <span className="block text-[14.5px] font-semibold">{q.label}</span>
                <span className="mt-1 block text-xs text-ink-muted">{q.sub}</span>
              </span>
              <span
                className={`h-[9px] w-[9px] shrink-0 rounded-pill ${
                  q.id === scope ? "bg-accent" : "bg-border"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {scope === "section_practice" ? (
        <div className="flex flex-col gap-3.5">
          <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-faint">
            Section
          </span>
          <div className="flex flex-col gap-2.5">
            {SECTIONS_BY_PAPER[paperId].map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={id === sectionId}
                onClick={() => onSectionChange(id)}
                className={`flex items-center justify-between rounded-row border px-4 py-3.5 text-left shadow-sm transition-colors ${
                  id === sectionId ? "border-accent bg-accent-tint" : "border-border bg-card"
                }`}
              >
                <span className="text-sm font-medium">{SECTION_LABELS[id]}</span>
                <span
                  className={`h-[9px] w-[9px] shrink-0 rounded-pill ${
                    id === sectionId ? "bg-accent" : "bg-border"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md flex-col gap-2.5 bg-gradient-to-t from-bg from-30% to-transparent px-7 pb-8 pt-5">
        <button
          type="button"
          onClick={onStart}
          disabled={isBusy}
          className="w-full rounded-row bg-accent px-4 py-4 text-[15px] font-semibold tracking-wide text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isBusy ? "Starting…" : "Start quiz"}
        </button>
        <p className="text-center text-xs text-ink-faint">
          You&apos;ll answer questions one at a time.
        </p>
      </div>
    </div>
  );
}

function QuizTaking({
  attempt,
  currentIndex,
  responses,
  isBusy,
  onSelectOption,
  onPrev,
  onNext,
  onSubmit,
}: {
  attempt: QuizAttemptDto;
  currentIndex: number;
  responses: Record<string, number>;
  isBusy: boolean;
  onSelectOption: (questionId: string, optionIndex: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
}): ReactElement {
  const question = attempt.questions[currentIndex];
  const total = attempt.questions.length;
  const isLast = currentIndex === total - 1;
  const answeredCount = Object.keys(responses).length;
  const progressPct = total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-7 px-7 pb-32 pt-8">
      <div>
        <div className="flex items-center justify-between">
          <span className="rounded-pill bg-accent-tint px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
            {SECTION_LABELS[question.sectionId]}
          </span>
          <span className="text-[12.5px] font-medium text-ink-faint">
            Q {currentIndex + 1} / {total}
          </span>
        </div>
        <div className="mt-4 h-[5px] w-full overflow-hidden rounded-pill bg-border">
          <div
            className="h-full rounded-pill bg-accent transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <p className="font-serif text-[21px] font-medium leading-relaxed">{question.prompt}</p>

      <div className="flex flex-col gap-3">
        {question.options.map((option, index) => {
          const isSelected = responses[question.id] === index;
          return (
            <button
              key={index}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectOption(question.id, index)}
              className={`flex items-center gap-3.5 rounded-row border px-4 py-3.5 text-left shadow-sm transition-colors ${
                isSelected ? "border-accent bg-accent-tint" : "border-border bg-card"
              }`}
            >
              <span
                className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-pill text-xs font-bold ${
                  isSelected ? "bg-accent text-white" : "bg-bg text-ink-muted"
                }`}
              >
                {OPTION_LETTERS[index]}
              </span>
              <span className="flex-1 text-[14.5px] leading-snug">{option}</span>
            </button>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md bg-gradient-to-t from-bg from-25% to-transparent px-7 pb-8 pt-4">
        <p className="mb-3.5 text-center text-[12.5px] text-ink-faint">
          {answeredCount} of {total} answered
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="flex-1 rounded-row border border-border bg-bg px-4 py-3.5 text-[14.5px] font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isBusy || answeredCount === 0}
              className="flex-1 rounded-row bg-accent px-4 py-3.5 text-[14.5px] font-semibold text-white disabled:opacity-50"
            >
              {isBusy ? "Submitting…" : "Submit quiz"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="flex-1 rounded-row bg-accent px-4 py-3.5 text-[14.5px] font-semibold text-white"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuizResultView({
  result,
  onRestart,
}: {
  result: QuizResultDto;
  onRestart: () => void;
}): ReactElement {
  return (
    <div className="flex flex-col gap-8 px-7 pb-10 pt-9">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
          Results
        </div>
        <h1 className="mt-3 font-serif text-[26px] font-semibold">Your results</h1>
      </div>

      <div className="rounded-card border border-border bg-card px-6 py-8 text-center shadow-sm">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-muted">
          Predicted score
        </p>
        <p className="mt-3 font-serif text-[58px] font-semibold leading-none text-accent">
          {Math.round(result.predictedScoreOutOf150)}
          <span className="text-[23px] font-medium text-ink-faint"> / 150</span>
        </p>
        <p className="mt-3.5 text-[12.5px] text-ink-faint">
          Raw score this session: {result.rawScore} / {result.rawTotal}
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
        <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-faint">
          Section breakdown
        </span>
        <div className="flex flex-col gap-2.5">
          {result.sections.map((section) => {
            const pct =
              section.predictedScoreOutOf30 > 0
                ? Math.min(1, section.predictedScoreOutOf30 / 30)
                : 0;
            return (
              <div
                key={section.sectionId}
                className="rounded-row border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <span className="flex-1 text-sm font-medium">
                    {SECTION_LABELS[section.sectionId]}
                  </span>
                  <span
                    className={`shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-bold ${
                      LABEL_PILL_CLASSES[section.label] ?? "bg-bg text-ink-faint"
                    }`}
                  >
                    {LABEL_TEXT[section.label] ?? section.label}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2.5">
                  <div className="h-[5px] flex-1 overflow-hidden rounded-pill bg-divider">
                    <div
                      className={`h-full rounded-pill ${
                        LABEL_BAR_CLASSES[section.label] ?? "bg-ink-faint"
                      }`}
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[11.5px] text-ink-faint">
                    {Math.round(section.predictedScoreOutOf30)} / 30
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onRestart}
        className="w-full rounded-row bg-accent px-4 py-4 text-[15px] font-semibold tracking-wide text-white shadow-sm transition-opacity hover:opacity-90"
      >
        Take another quiz
      </button>
    </div>
  );
}
