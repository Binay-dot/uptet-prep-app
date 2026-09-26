# 0003 — Content sourcing and IRT calibration approach

## Context
The product's core value is an accurate score/readiness prediction, which
depends entirely on trustworthy question content and honestly-measured
item difficulty. Early discussion considered using AI to generate
questions freely, and using online sources broadly for content.

## Decision
1. **Primary content source: official UPBEB past-year papers and their
   official answer keys** (published at updeled.gov.in), not third-party
   coaching sites' reproductions of them.
2. **New AI-drafted questions must be grounded in real source material**
   (a specific past question or a specific NCERT/syllabus topic passed
   into the prompt) — never open-ended "write a UPTET question" generation.
3. **Every AI-drafted question is reviewed by a named human reviewer**
   before it's usable at all (see feature 002).
4. **Difficulty/discrimination parameters are never hand-assigned.** New
   items enter as "calibration" items mixed into real practice quizzes;
   their parameters are computed from real response data before they're
   promoted to counting toward a user's visible ability estimate.
5. v1 targets roughly 1,000–1,400 unique items across both papers (one
   language track, one Paper 2 specialization track), leaning primarily on
   real historical PYQs to fill most of that volume before new authored
   content is needed.

## Reasoning
Research into both IRT field-testing practice and specific failure modes
of AI-generated exam content informed this:
- Real testing programs never hand-assign item parameters; they field-test
  and calibrate from response data
  (https://edukatesg.com/2026/09/13/how-item-field-testing-works-pretest-questions-before-scores-count/).
- AI-generated exam questions, without grounding and review, commonly
  produce confident factual errors and items that don't actually
  discriminate between prepared and unprepared candidates
  (https://medium.com/@mmcnelis/why-ai-generated-practice-exams-keep-failing-real-candidates-c974da7b7a43).
- In this specific market, a single wrong answer circulating on social
  media can break trust in the app entirely — correctness is not a nice-
  to-have, it's the whole product.

## Conditions for revisiting
- If official PDF sourcing proves impractical (format changes, access
  issues), revisit with a documented reason before falling back to
  third-party sources.
- The calibration-to-live promotion threshold is intentionally left as a
  tuning decision for implementation time, not fixed here.
