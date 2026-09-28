import dotenv from "dotenv";
import path from "node:path";

// Same reasoning as migrate.ts / drizzle.config.ts: cwd here is
// packages/database, but .env lives at the repo root.
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

import { getDb, schema } from "./index";

/**
 * DEV-ONLY seed data. This is NOT feature 002 (content ingestion) — these
 * are a handful of made-up questions so the quiz-taking UI (feature 001)
 * has something real to serve against a local/dev database while the
 * actual UPTET PYQ sourcing work is still open (see
 * docs/work/current.md, "Next" item on sourcing PYQs).
 *
 * Marked `source: "ai_drafted"`, `status: "pyq_verified"` would be a lie
 * (these are neither past-paper-sourced nor reviewer-approved) — instead
 * these go in as `ai_drafted` / `calibration` with `responseCount` high
 * enough to be promoted to "live" quickly during manual testing, matching
 * the real lifecycle rather than special-casing seed data through it.
 *
 * Safe to re-run: it deletes only rows it previously inserted (matched by
 * `sourceNote`), never touches real content.
 */
const SEED_MARKER = "dev-seed-v1";

type SeedQuestion = {
  paperId: "paper_1" | "paper_2";
  sectionId:
    | "child_development_pedagogy"
    | "language_1_hindi"
    | "language_2_english"
    | "mathematics"
    | "evs"
    | "social_studies";
  prompt: string;
  options: [string, string, string, string];
  correctOptionIndex: 0 | 1 | 2 | 3;
};

const SEED_QUESTIONS: SeedQuestion[] = [
  // --- Paper 1: child_development_pedagogy ---
  {
    paperId: "paper_1",
    sectionId: "child_development_pedagogy",
    prompt: "According to Piaget, a child in the 'concrete operational' stage is typically aged:",
    options: ["0-2 years", "2-7 years", "7-11 years", "11+ years"],
    correctOptionIndex: 2,
  },
  {
    paperId: "paper_1",
    sectionId: "child_development_pedagogy",
    prompt: "Which of the following best describes 'formative assessment'?",
    options: [
      "A single end-of-year exam",
      "Ongoing assessment used to guide teaching during learning",
      "An assessment only for ranking students",
      "An assessment conducted only by external examiners",
    ],
    correctOptionIndex: 1,
  },
  {
    paperId: "paper_1",
    sectionId: "child_development_pedagogy",
    prompt: "Inclusive education primarily aims to:",
    options: [
      "Separate children by ability",
      "Educate children with diverse needs together in the same classroom",
      "Remove all assessments",
      "Focus only on gifted children",
    ],
    correctOptionIndex: 1,
  },
  // --- language_1_hindi ---
  {
    paperId: "paper_1",
    sectionId: "language_1_hindi",
    prompt: "'पुस्तक' शब्द का पर्यायवाची शब्द है:",
    options: ["ग्रंथ", "नदी", "आकाश", "वृक्ष"],
    correctOptionIndex: 0,
  },
  {
    paperId: "paper_1",
    sectionId: "language_1_hindi",
    prompt: "निम्नलिखित में से कौन-सा शब्द 'तत्सम' है?",
    options: ["आग", "अग्नि", "आँख", "काम"],
    correctOptionIndex: 1,
  },
  // --- language_2_english ---
  {
    paperId: "paper_1",
    sectionId: "language_2_english",
    prompt: "Choose the correctly spelled word:",
    options: ["Recieve", "Receive", "Receeve", "Receve"],
    correctOptionIndex: 1,
  },
  {
    paperId: "paper_1",
    sectionId: "language_2_english",
    prompt: "Identify the synonym of 'Abundant':",
    options: ["Scarce", "Plentiful", "Empty", "Limited"],
    correctOptionIndex: 1,
  },
  // --- mathematics (Paper 1 only) ---
  {
    paperId: "paper_1",
    sectionId: "mathematics",
    prompt: "What is the sum of the first 10 natural numbers?",
    options: ["45", "50", "55", "60"],
    correctOptionIndex: 2,
  },
  {
    paperId: "paper_1",
    sectionId: "mathematics",
    prompt: "The place value of 7 in 3,704 is:",
    options: ["7", "70", "700", "7000"],
    correctOptionIndex: 2,
  },
  // --- evs (Paper 1 only) ---
  {
    paperId: "paper_1",
    sectionId: "evs",
    prompt: "Which of these is a renewable source of energy?",
    options: ["Coal", "Petroleum", "Solar energy", "Natural gas"],
    correctOptionIndex: 2,
  },
  {
    paperId: "paper_1",
    sectionId: "evs",
    prompt: "The main aim of teaching EVS at the primary stage is to:",
    options: [
      "Prepare children for competitive exams only",
      "Connect classroom learning to the child's immediate environment",
      "Teach only physics and chemistry formulas",
      "Focus solely on memorizing facts",
    ],
    correctOptionIndex: 1,
  },
  // --- Paper 2: child_development_pedagogy (shared) ---
  {
    paperId: "paper_2",
    sectionId: "child_development_pedagogy",
    prompt: "A teacher who values 'multiple intelligences' (Gardner) in the classroom is most likely to:",
    options: [
      "Use only one teaching method for all students",
      "Offer varied activities addressing different strengths",
      "Rank students strictly by IQ",
      "Ignore individual differences",
    ],
    correctOptionIndex: 1,
  },
  {
    paperId: "paper_2",
    sectionId: "child_development_pedagogy",
    prompt: "Vygotsky's 'Zone of Proximal Development' refers to:",
    options: [
      "Tasks a child can do without any help",
      "Tasks a child cannot do even with help",
      "The gap between what a child can do alone vs. with guidance",
      "A child's physical growth zone",
    ],
    correctOptionIndex: 2,
  },
  // --- Paper 2: language_1_hindi (shared, reused prompts kept distinct) ---
  {
    paperId: "paper_2",
    sectionId: "language_1_hindi",
    prompt: "'ईमानदार' शब्द में उपसर्ग है:",
    options: ["ई", "ईमान", "दार", "कोई नहीं"],
    correctOptionIndex: 0,
  },
  // --- Paper 2: language_2_english (shared) ---
  {
    paperId: "paper_2",
    sectionId: "language_2_english",
    prompt: "Fill in the blank: 'She ___ to school every day.'",
    options: ["go", "goes", "going", "gone"],
    correctOptionIndex: 1,
  },
  // --- social_studies (Paper 2 only) ---
  {
    paperId: "paper_2",
    sectionId: "social_studies",
    prompt: "The Indian Constitution was adopted on:",
    options: ["15 August 1947", "26 January 1950", "26 November 1949", "2 October 1950"],
    correctOptionIndex: 2,
  },
  {
    paperId: "paper_2",
    sectionId: "social_studies",
    prompt: "Which of these is a fundamental duty under the Indian Constitution?",
    options: [
      "Right to vote",
      "To protect the sovereignty and integrity of India",
      "Right to property",
      "Right to education only",
    ],
    correctOptionIndex: 1,
  },
];

async function main() {
  const db = getDb();

  console.log(`Seeding ${SEED_QUESTIONS.length} dev-only questions (marker: ${SEED_MARKER})...`);

  // Idempotent: remove any previously seeded rows first, then re-insert.
  await db.delete(schema.questions).where(
    // sourceNote is our marker column for seed data.
    // (drizzle eq import kept local to avoid a top-level unused import
    // when this file is read outside of the delete/insert flow)
    (await import("drizzle-orm")).eq(schema.questions.sourceNote, SEED_MARKER),
  );

  await db.insert(schema.questions).values(
    SEED_QUESTIONS.map((q) => ({
      paperId: q.paperId,
      sectionId: q.sectionId,
      prompt: q.prompt,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      source: "ai_drafted" as const,
      status: "calibration" as const,
      sourceNote: SEED_MARKER,
      // High response count so a manual test quiz promotes these to
      // "live" quickly and section estimates aren't stuck at "still
      // calibrating" for the whole dev session. Not realistic data —
      // dev convenience only.
      responseCount: 0,
    })),
  );

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
