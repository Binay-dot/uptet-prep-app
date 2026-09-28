import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

import { getDb, schema } from "./index";
import { and, eq, sql } from "drizzle-orm";

/**
 * One-off content fix for the UPTET 2019 Paper 1 ingest (see
 * ingest-pyq-2019-paper1.ts). Two content bugs were found after review:
 *   1. Two English follow-up questions (forgiveness passage, "untrodden
 *      ways" poem) didn't repeat the source passage, so they lost context
 *      when shown one-at-a-time in the quiz UI.
 *   2. Three "Match List-A with List-B" questions had their prompt and
 *      options collapsed into jammed strings (e.g. "a-III b-I c-II d-V"),
 *      reading as jumbled.
 *
 * This does NOT delete/reinsert (that violates the RESTRICT FK from
 * quiz_attempt_questions once real attempts exist against these rows —
 * see docs/work/current.md, real test attempts already reference them).
 * Instead it UPDATEs the 6 affected rows in place, matched by their exact
 * OLD prompt text + the same sourceNote used at ingest time, so ids (and
 * therefore attempt history) are preserved. The other 113 rows from that
 * ingest are untouched — their text never changed.
 */
const SOURCE_NOTE = "UPTET 2019 Paper 1 (Set B), via adda247 reproduction — answers independently verified by Claude, not transcribed from the scanned key";

type Fix = {
  oldPrompt: string;
  newPrompt: string;
  newOptions: [string, string, string, string];
};

const FIXES: Fix[] = [
  {
    oldPrompt: "Based on the same passage about forgiveness: one who does not take revenge is",
    newPrompt: "Passage: \"To forgive an injury is often considered to be a sign of weakness; it is really a sign of strength... So mercy is the noblest form of revenge.\" According to the passage, one who does not take revenge is",
    newOptions: ["a weak man", "a foolish man", "a strong man", "a foe"],
  },
  {
    oldPrompt: "Poem: \"She dwelt among the untrodden ways / Beside the spring of Dove...\" What is the meaning of the word 'untrodden'?",
    newPrompt: "Poem: \"She dwelt among the untrodden ways / Beside the spring of Dove... / A violet by mossy stone / Half-hidden from the eye! / Fair as a star when only one / is shining in the sky.\" What is the meaning of the word 'untrodden'?",
    newOptions: ["Unexplored", "Hidden", "Explored", "Explicit"],
  },
  {
    oldPrompt: "In the same poem's second stanza (\"A violet by mossy stone / Half-hidden from the eye! / Fair as a star when only one / is shining in the sky\"), identify the figure of speech used.",
    newPrompt: "Poem: \"She dwelt among the untrodden ways / Beside the spring of Dove... / A violet by mossy stone / Half-hidden from the eye! / Fair as a star when only one / is shining in the sky.\" In the second stanza (\"A violet by mossy stone... / is shining in the sky\"), identify the figure of speech used.",
    newOptions: ["Metaphor", "Alliteration", "Pun", "Simile"],
  },
  {
    oldPrompt: "Match List-A with List-B — a.Bruner b.Ausubel c.Glasser d.Gordon / I.Basic teaching model II.Synectics teaching model III.Advance organiser teaching model IV.Concept attainment teaching model V.Inquiry training model",
    newPrompt: "Match List-A with List-B.\nList-A: (a) Bruner (b) Ausubel (c) Glasser (d) Gordon\nList-B: (I) Basic teaching model (II) Synectics teaching model (III) Advance organiser teaching model (IV) Concept attainment teaching model (V) Inquiry training model",
    newOptions: ["(a)-III, (b)-I, (c)-II, (d)-V", "(a)-IV, (b)-III, (c)-II, (d)-I", "(a)-IV, (b)-III, (c)-I, (d)-II", "(a)-I, (b)-II, (c)-III, (d)-V"],
  },
  {
    oldPrompt: "Match Column-A with Column-B — a.Animal Intelligence b.Schedule of reinforcement c.Law of pragnanz d.Adaptation / I.Gestalt II.Piaget III.Thorndike IV.Skinner",
    newPrompt: "Match Column-A with Column-B.\nColumn-A: (a) Animal Intelligence (b) Schedule of reinforcement (c) Law of pragnanz (d) Adaptation\nColumn-B: (I) Gestalt (II) Piaget (III) Thorndike (IV) Skinner",
    newOptions: ["(a)-III, (b)-IV, (c)-I, (d)-II", "(a)-II, (b)-IV, (c)-III, (d)-I", "(a)-I, (b)-IV, (c)-III, (d)-II", "(a)-II, (b)-IV, (c)-I, (d)-III"],
  },
  {
    oldPrompt: "Match List-I with List-II — a.Indian Union b.State c.Corporation d.Village Panchayat / A.Prime Minister B.Sarpanch C.Governor D.Mayor",
    newPrompt: "Match List-I with List-II.\nList-I: (a) Indian Union (b) State (c) Corporation (d) Village Panchayat\nList-II: (A) Prime Minister (B) Sarpanch (C) Governor (D) Mayor",
    newOptions: ["(a)-D, (b)-A, (c)-B, (d)-C", "(a)-A, (b)-C, (c)-D, (d)-B", "(a)-B, (b)-C, (c)-D, (d)-A", "(a)-C, (b)-D, (c)-A, (d)-B"],
  },
];

async function main() {
  const db = getDb();
  console.log(`Applying ${FIXES.length} targeted content fixes (matched by old prompt text + sourceNote)...`);

  for (const fix of FIXES) {
    const result = await db
      .update(schema.questions)
      .set({ prompt: fix.newPrompt, options: fix.newOptions })
      .where(
        and(
          eq(schema.questions.sourceNote, SOURCE_NOTE),
          eq(schema.questions.prompt, fix.oldPrompt),
        ),
      )
      .returning({ id: schema.questions.id });

    if (result.length === 0) {
      throw new Error(
        `No row matched old prompt (nothing updated, check text/whitespace exactly):\n"${fix.oldPrompt}"`,
      );
    }
    if (result.length > 1) {
      throw new Error(
        `Old prompt matched ${result.length} rows, expected exactly 1 — ambiguous match:\n"${fix.oldPrompt}"`,
      );
    }
    console.log(`  updated id=${result[0].id}: "${fix.oldPrompt.slice(0, 50)}..." -> "${fix.newPrompt.slice(0, 50)}..."`);
  }

  console.log("Done. All 6 rows updated in place (ids unchanged, attempt history intact).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
