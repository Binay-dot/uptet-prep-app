import { z } from "zod";
import { PaperId, SectionId, QuestionSource, QuestionStatus } from "./enums";

/**
 * A question as the CLIENT sees it (no correct answer, no IRT parameters —
 * those never leave the server before an attempt is scored).
 */
export const QuestionDto = z
  .object({
    id: z.string().uuid(),
    paperId: PaperId,
    sectionId: SectionId,
    prompt: z.string().min(1).max(2000),
    options: z.array(z.string().min(1).max(500)).length(4),
  })
  .strict();
export type QuestionDto = z.infer<typeof QuestionDto>;

/**
 * Internal, server-only representation. Never send `correctOptionIndex` or
 * `difficulty`/`discrimination` to a client before an attempt is scored.
 */
export const QuestionRecord = z
  .object({
    id: z.string().uuid(),
    paperId: PaperId,
    sectionId: SectionId,
    prompt: z.string().min(1).max(2000),
    options: z.array(z.string().min(1).max(500)).length(4),
    correctOptionIndex: z.number().int().min(0).max(3),
    source: QuestionSource,
    status: QuestionStatus,
    // Source provenance — required for pyq, optional for ai_drafted until reviewed
    sourceYear: z.number().int().min(2011).max(2100).optional(),
    sourceNote: z.string().max(500).optional(),
    // IRT parameters. Null until the item has enough response data.
    // Never hand-assigned — see docs/decisions/0003-content-and-scoring.md.
    difficulty: z.number().finite().nullable(),
    discrimination: z.number().finite().positive().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type QuestionRecord = z.infer<typeof QuestionRecord>;

/**
 * A single answer a user submits during a quiz attempt.
 */
export const SubmitResponseInput = z
  .object({
    questionId: z.string().uuid(),
    selectedOptionIndex: z.number().int().min(0).max(3),
  })
  .strict();
export type SubmitResponseInput = z.infer<typeof SubmitResponseInput>;
