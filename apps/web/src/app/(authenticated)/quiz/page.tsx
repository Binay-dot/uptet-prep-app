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
 * Feature 001 (docs/features/001-quiz-and-score-prediction.md), first
 * real UI pass. Deliberately unstyled-but-usable, matching the rest of
 * the app right now (see dashboard/page.tsx, (public)/page.tsx comments)
 * — a real visual design pass is planned separately (docs/work/current.md
 * "Next" #4).
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

const LABEL_STYLES: Record<string, string> = {
  strong: "bg-green-100 text-green-800",
  developing: "bg-yellow-100 text-yellow-800",
  needs_work: "bg-red-100 text-red-800",
};

type Phase = "config" | "taking" | "result";

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
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Practice Quiz</h1>

      {error ? (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      {phase === "config" ? (
        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Paper</span>
            <select
              className="rounded-md border border-gray-300 p-2"
              value={paperId}
              onChange={(e) => handlePaperChange(e.target.value as PaperId)}
            >
              <option value="paper_1">Paper 1 (Primary)</option>
              <option value="paper_2">Paper 2 (Upper Primary)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Quiz type</span>
            <select
              className="rounded-md border border-gray-300 p-2"
              value={scope}
              onChange={(e) => setScope(e.target.value as QuizScope)}
            >
              <option value="full_mock">Full mock paper</option>
              <option value="section_practice">Single section practice</option>
            </select>
          </label>

          {scope === "section_practice" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Section</span>
              <select
                className="rounded-md border border-gray-300 p-2"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value as SectionId)}
              >
                {SECTIONS_BY_PAPER[paperId].map((id) => (
                  <option key={id} value={id}>
                    {SECTION_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button
            type="button"
            onClick={handleStart}
            disabled={isBusy}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isBusy ? "Starting..." : "Start quiz"}
          </button>
        </div>
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
  const isLast = currentIndex === attempt.questions.length - 1;
  const answeredCount = Object.keys(responses).length;

  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Question {currentIndex + 1} of {attempt.questions.length} &middot;{" "}
        {SECTION_LABELS[question.sectionId]} &middot; {answeredCount} answered
      </p>

      <p className="text-base font-medium">{question.prompt}</p>

      <div className="flex flex-col gap-2">
        {question.options.map((option, index) => (
          <label
            key={index}
            className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${
              responses[question.id] === index
                ? "border-black bg-gray-50"
                : "border-gray-300"
            }`}
          >
            <input
              type="radio"
              name={question.id}
              checked={responses[question.id] === index}
              onChange={() => onSelectOption(question.id, index)}
            />
            {option}
          </label>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          Previous
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isBusy || answeredCount === 0}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isBusy ? "Submitting..." : "Submit quiz"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Next
          </button>
        )}
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
    <div className="mt-4 flex flex-col gap-4">
      <div className="rounded-md bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">Predicted score</p>
        <p className="text-3xl font-semibold">
          {Math.round(result.predictedScoreOutOf150)} / 150
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Raw score this session: {result.rawScore} / {result.rawTotal}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Section breakdown</h2>
        {result.sections.map((section) => (
          <div
            key={section.sectionId}
            className="flex items-center justify-between rounded-md border border-gray-200 p-3 text-sm"
          >
            <div>
              <p className="font-medium">{SECTION_LABELS[section.sectionId]}</p>
              <p className="text-xs text-gray-500">
                Predicted: {Math.round(section.predictedScoreOutOf30)} / 30
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${
                LABEL_STYLES[section.label] ?? "bg-gray-100 text-gray-800"
              }`}
            >
              {section.label.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onRestart}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
      >
        Take another quiz
      </button>
    </div>
  );
}
