import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

import { getDb, schema } from "./index";
import { and, eq, gte, inArray, isNotNull } from "drizzle-orm";
import {
  estimateAbilityEap,
  estimateItemDifficultyEap,
  toScoredResponse,
  MIN_RESPONSES_TO_ATTEMPT_CALIBRATION,
  type ItemCalibrationResponse,
} from "@uptet/domain";

/**
 * Item-calibration job (docs/decisions/0006-item-calibration-job.md).
 *
 * For every `calibration`-status question with enough recorded responses
 * (MIN_RESPONSES_TO_ATTEMPT_CALIBRATION, packages/domain's
 * calibrationPolicy.ts), computes a real IRT 1PL difficulty estimate from
 * real response data and writes it to `questions.difficulty` /
 * `difficultyStandardError`. This does NOT itself flip status to `live` —
 * that promotion still happens in apps/web's quiz service, gated on
 * responseCount + a non-null difficulty + a low-enough standardError (see
 * packages/domain/src/scoring/calibrationPolicy.ts). This job only
 * produces the difficulty; the service decides when it's trustworthy
 * enough to count.
 *
 * METHOD: for each candidate item, gather every recorded response to it,
 * and for each response, compute the respondent's ability (theta) as a
 * *leave-one-out* EAP estimate — from every OTHER item they answered in
 * the same section of the same attempt, excluding this very response.
 * Then run estimateItemDifficultyEap() over the resulting
 * {theta, correct} pairs. See itemCalibration.ts for the full reasoning
 * (why leave-one-out, why EAP not MLE).
 *
 * Deliberately NOT wrapped in one big transaction across all candidate
 * items — each item's difficulty update is independent and this job is
 * safe to re-run (it always recomputes from current response data, which
 * is exactly what should happen as more field-test responses accrue
 * between runs).
 *
 * Run manually/periodically for now — no scheduler/cron infra exists yet
 * (out of scope for this pass, same as the rest of feature 002's
 * automation). See docs/work/current.md for when this last ran.
 */
async function main() {
  const db = getDb();

  const candidates = await db.query.questions.findMany({
    where: and(
      eq(schema.questions.status, "calibration"),
      gte(schema.questions.responseCount, MIN_RESPONSES_TO_ATTEMPT_CALIBRATION),
    ),
  });

  console.log(
    `Found ${candidates.length} calibration-status question(s) with >= ${MIN_RESPONSES_TO_ATTEMPT_CALIBRATION} responses.`,
  );

  let updated = 0;

  for (const question of candidates) {
    // Every answered response to the specific item being calibrated.
    const targetResponses = await db.query.quizAttemptQuestions.findMany({
      where: and(
        eq(schema.quizAttemptQuestions.questionId, question.id),
        isNotNull(schema.quizAttemptQuestions.selectedOptionIndex),
      ),
    });

    if (targetResponses.length === 0) {
      console.log(`  skip ${question.id}: responseCount says answers exist but none found (unexpected, leaving as-is)`);
      continue;
    }

    const attemptIds = [...new Set(targetResponses.map((r) => r.attemptId))];

    // Every answered response in the SAME section, across those same
    // attempts — the raw material for each respondent's leave-one-out
    // ability estimate. One query, grouped in memory below, rather than
    // one query per response.
    const sameSectionResponsesInAttempts = await db
      .select({
        attemptId: schema.quizAttemptQuestions.attemptId,
        questionId: schema.quizAttemptQuestions.questionId,
        isCorrect: schema.quizAttemptQuestions.isCorrect,
        difficultyAtAttempt: schema.quizAttemptQuestions.difficultyAtAttempt,
      })
      .from(schema.quizAttemptQuestions)
      .innerJoin(schema.questions, eq(schema.quizAttemptQuestions.questionId, schema.questions.id))
      .where(
        and(
          inArray(schema.quizAttemptQuestions.attemptId, attemptIds),
          eq(schema.questions.sectionId, question.sectionId),
          isNotNull(schema.quizAttemptQuestions.selectedOptionIndex),
        ),
      );

    const byAttempt = new Map<string, typeof sameSectionResponsesInAttempts>();
    for (const response of sameSectionResponsesInAttempts) {
      const list = byAttempt.get(response.attemptId) ?? [];
      list.push(response);
      byAttempt.set(response.attemptId, list);
    }

    const calibrationResponses: ItemCalibrationResponse[] = [];
    for (const target of targetResponses) {
      const sameSectionInAttempt = byAttempt.get(target.attemptId) ?? [];
      // Leave-one-out: exclude the item under calibration itself from
      // the ability estimate used to calibrate it.
      const otherResponses = sameSectionInAttempt.filter(
        (r) => r.questionId !== question.id,
      );
      const scored = otherResponses.map((r) =>
        toScoredResponse(r.difficultyAtAttempt, r.isCorrect ?? false),
      );
      const { theta } = estimateAbilityEap(scored);
      calibrationResponses.push({ theta, correct: target.isCorrect ?? false });
    }

    const { difficulty, standardError } = estimateItemDifficultyEap(calibrationResponses);

    await db
      .update(schema.questions)
      .set({
        difficulty,
        difficultyStandardError: standardError,
        updatedAt: new Date(),
      })
      .where(eq(schema.questions.id, question.id));

    updated++;
    console.log(
      `  ${question.sectionId} ${question.id}: difficulty=${difficulty.toFixed(3)} se=${standardError.toFixed(3)} (from ${calibrationResponses.length} responses)`,
    );
  }

  console.log(`Done. Updated difficulty for ${updated}/${candidates.length} candidate question(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
