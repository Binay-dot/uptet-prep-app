import { z } from "zod";
import { PaperId, SectionId, QuizScope } from "./enums";
import { QuestionDto, SubmitResponseInput } from "./question";

export const StartQuizInput = z
  .object({
    paperId: PaperId,
    scope: QuizScope,
    // required when scope = "section_practice"; ignored for full_mock
    sectionId: SectionId.optional(),
  })
  .strict()
  .refine(
    (data) => data.scope !== "section_practice" || !!data.sectionId,
    { message: "sectionId is required for section_practice", path: ["sectionId"] },
  );
export type StartQuizInput = z.infer<typeof StartQuizInput>;

export const QuizAttemptDto = z
  .object({
    id: z.string().uuid(),
    paperId: PaperId,
    scope: QuizScope,
    sectionId: SectionId.optional(),
    questions: z.array(QuestionDto),
    startedAt: z.string().datetime(),
  })
  .strict();
export type QuizAttemptDto = z.infer<typeof QuizAttemptDto>;

export const SubmitQuizAttemptInput = z
  .object({
    attemptId: z.string().uuid(),
    responses: z.array(SubmitResponseInput).min(1),
  })
  .strict();
export type SubmitQuizAttemptInput = z.infer<typeof SubmitQuizAttemptInput>;

/**
 * What the user sees after submitting — the whole point of the app.
 * See docs/features/001-quiz-and-score-prediction.md.
 */
export const SectionBreakdownDto = z
  .object({
    sectionId: SectionId,
    abilityEstimate: z.number().finite(),
    // standard error of the estimate — lets the UI show "still calibrating"
    // for a new user rather than a falsely precise number
    standardError: z.number().finite().positive(),
    predictedScoreOutOf30: z.number().min(0).max(30),
    label: z.enum(["strong", "developing", "needs_work"]),
  })
  .strict();
export type SectionBreakdownDto = z.infer<typeof SectionBreakdownDto>;

export const QuizResultDto = z
  .object({
    attemptId: z.string().uuid(),
    paperId: PaperId,
    rawScore: z.number().int().min(0),
    rawTotal: z.number().int().min(1),
    predictedScoreOutOf150: z.number().min(0).max(150),
    sections: z.array(SectionBreakdownDto),
    completedAt: z.string().datetime(),
  })
  .strict();
export type QuizResultDto = z.infer<typeof QuizResultDto>;
