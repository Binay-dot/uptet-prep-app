import { getDb, schema } from "@uptet/database";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  estimateAbilityEap,
  estimateAndPredictScore,
  sectionLabelFor,
  toScoredResponse,
  type ScoredResponse,
} from "@uptet/domain";
import type {
  StartQuizInput,
  QuizAttemptDto,
  SubmitQuizAttemptInput,
  QuizResultDto,
  SectionBreakdownDto,
  SectionId,
} from "@uptet/contracts";
import type { Actor } from "../../auth/actor";
import { conflict, forbidden, notFound } from "../../http/apiError";
import { SECTIONS_BY_PAPER } from "./paperSections";

const QUESTIONS_PER_SECTION_PRACTICE = 10;
const QUESTIONS_PER_SECTION_IN_FULL_MOCK = 6;

/**
 * An item only counts toward calibration -> live once it has this many
 * recorded responses. A tuning decision, not a hard number to nail down
 * up front — see docs/features/002-content-ingestion-and-review.md
 * ("start conservative"). Deliberately a small placeholder for v1's early
 * days with a small item bank; revisit once real usage data exists
 * (candidate for docs/feedback/lessons.md once it does).
 */
const RESPONSES_NEEDED_FOR_LIVE_STATUS = 30;

async function pickQuestionsForSection(
  paperId: StartQuizInput["paperId"],
  sectionId: SectionId,
  count: number,
) {
  const db = getDb();
  return db
    .select()
    .from(schema.questions)
    .where(
      and(
        eq(schema.questions.paperId, paperId),
        eq(schema.questions.sectionId, sectionId),
        inArray(schema.questions.status, ["live", "calibration", "pyq_verified"]),
      ),
    )
    .orderBy(sql`random()`)
    .limit(count);
}

export async function startQuiz(
  actor: Actor,
  input: StartQuizInput,
): Promise<QuizAttemptDto> {
  const db = getDb();

  const sectionPlan: Array<{ sectionId: SectionId; count: number }> =
    input.scope === "section_practice"
      ? [{ sectionId: input.sectionId!, count: QUESTIONS_PER_SECTION_PRACTICE }]
      : SECTIONS_BY_PAPER[input.paperId].map((sectionId) => ({
          sectionId,
          count: QUESTIONS_PER_SECTION_IN_FULL_MOCK,
        }));

  const selectedByeSection = await Promise.all(
    sectionPlan.map((plan) =>
      pickQuestionsForSection(input.paperId, plan.sectionId, plan.count),
    ),
  );
  const selected = selectedByeSection.flat();

  if (selected.length === 0) {
    throw notFound(
      "No questions are available yet for this paper/section. The item bank is still being loaded.",
    );
  }

  return db.transaction(async (tx) => {
    const [attempt] = await tx
      .insert(schema.quizAttempts)
      .values({
        userId: actor.userId,
        paperId: input.paperId,
        scope: input.scope,
        sectionId: input.scope === "section_practice" ? input.sectionId : undefined,
      })
      .returning();

    await tx.insert(schema.quizAttemptQuestions).values(
      selected.map((question, index) => ({
        attemptId: attempt.id,
        questionId: question.id,
        orderIndex: index,
        // Snapshot now — see quizAttempts.ts schema comment on why this
        // must not be a live re-read of questions.difficulty later.
        difficultyAtAttempt: question.difficulty,
      })),
    );

    return {
      id: attempt.id,
      paperId: attempt.paperId,
      scope: attempt.scope,
      sectionId: attempt.sectionId ?? undefined,
      questions: selected.map((question) => ({
        id: question.id,
        paperId: question.paperId,
        sectionId: question.sectionId,
        prompt: question.prompt,
        options: question.options,
      })),
      startedAt: attempt.startedAt.toISOString(),
    };
  });
}

export async function submitQuiz(
  actor: Actor,
  input: SubmitQuizAttemptInput,
): Promise<QuizResultDto> {
  const db = getDb();

  const attempt = await db.query.quizAttempts.findFirst({
    where: eq(schema.quizAttempts.id, input.attemptId),
  });
  if (!attempt) throw notFound("Quiz attempt not found.");
  if (attempt.userId !== actor.userId) {
    throw forbidden("This quiz attempt does not belong to you.");
  }
  if (attempt.completedAt) {
    throw conflict("This quiz attempt has already been submitted.");
  }

  const attemptQuestions = await db.query.quizAttemptQuestions.findMany({
    where: eq(schema.quizAttemptQuestions.attemptId, attempt.id),
  });
  const questionIds = attemptQuestions.map((q) => q.questionId);
  const questionRows = await db.query.questions.findMany({
    where: inArray(schema.questions.id, questionIds),
  });
  const questionById = new Map(questionRows.map((q) => [q.id, q]));

  return db.transaction(async (tx) => {
    let rawScore = 0;
    let rawTotal = 0;
    // For overall + per-section ability estimation. How a response maps
    // to a ScoredResponse (including the uncalibrated-item fallback) is
    // NOT decided here — it's the pure, tested toScoredResponse()
    // function in packages/domain. See
    // docs/decisions/0005-neutral-difficulty-fallback-for-scoring.md:
    // this used to be inline, untested logic here, and that's exactly
    // how the "every quiz scores 75/150" bug slipped through silently.
    // Don't inline this again — change toScoredResponse instead, with
    // its regression test updated to match.
    const scoredBySection = new Map<SectionId, ScoredResponse[]>();
    const allScored: ScoredResponse[] = [];

    for (const response of input.responses) {
      const attemptQuestion = attemptQuestions.find(
        (q) => q.questionId === response.questionId,
      );
      const question = questionById.get(response.questionId);
      if (!attemptQuestion || !question) {
        // Silently ignore a response for a question that wasn't part of
        // this attempt — not this endpoint's job to validate that beyond
        // not crashing; the client-side quiz UI only ever submits
        // questions it was actually served.
        continue;
      }

      const isCorrect = response.selectedOptionIndex === question.correctOptionIndex;
      rawTotal += 1;
      if (isCorrect) rawScore += 1;

      await tx
        .update(schema.quizAttemptQuestions)
        .set({
          selectedOptionIndex: response.selectedOptionIndex,
          isCorrect,
          answeredAt: new Date(),
        })
        .where(eq(schema.quizAttemptQuestions.id, attemptQuestion.id));

      await tx
        .update(schema.questions)
        .set({ responseCount: sql`${schema.questions.responseCount} + 1` })
        .where(eq(schema.questions.id, question.id));

      const scored: ScoredResponse = toScoredResponse(
        attemptQuestion.difficultyAtAttempt,
        isCorrect,
      );
      allScored.push(scored);
      const existing = scoredBySection.get(question.sectionId) ?? [];
      existing.push(scored);
      scoredBySection.set(question.sectionId, existing);
    }

    // Promote items that just crossed the calibration threshold. This is
    // a placeholder promotion rule (response count only) — it does NOT
    // compute a real difficulty estimate from response data. That's a
    // genuinely separate piece of work (an item-calibration job) that
    // hasn't been built yet; flagged in docs/feedback/lessons.md.
    await tx
      .update(schema.questions)
      .set({ status: "live" })
      .where(
        and(
          inArray(schema.questions.id, [...questionById.keys()]),
          eq(schema.questions.status, "calibration"),
          sql`${schema.questions.responseCount} >= ${RESPONSES_NEEDED_FOR_LIVE_STATUS}`,
        ),
      );

    const sections: SectionBreakdownDto[] = [];
    for (const [sectionId, responses] of scoredBySection.entries()) {
      const { theta, standardError } = estimateAbilityEap(responses);
      const predictedScoreOutOf30 = estimateAndPredictScore(responses, 30).predictedScore;
      const label = sectionLabelFor(theta, standardError);

      sections.push({
        sectionId,
        abilityEstimate: theta,
        standardError,
        predictedScoreOutOf30,
        label,
      });

      await tx
        .insert(schema.sectionAbilityEstimates)
        .values({ userId: actor.userId, sectionId, theta, standardError })
        .onConflictDoUpdate({
          target: [
            schema.sectionAbilityEstimates.userId,
            schema.sectionAbilityEstimates.sectionId,
          ],
          set: { theta, standardError, updatedAt: new Date() },
        });
    }

    const overall = estimateAndPredictScore(allScored, 150);

    const [updatedAttempt] = await tx
      .update(schema.quizAttempts)
      .set({
        completedAt: new Date(),
        rawScore,
        rawTotal,
        predictedScoreOutOf150: overall.predictedScore,
      })
      .where(eq(schema.quizAttempts.id, attempt.id))
      .returning();

    return {
      attemptId: updatedAttempt.id,
      paperId: updatedAttempt.paperId,
      rawScore,
      rawTotal,
      predictedScoreOutOf150: overall.predictedScore,
      sections,
      completedAt: updatedAttempt.completedAt!.toISOString(),
    };
  });
}
