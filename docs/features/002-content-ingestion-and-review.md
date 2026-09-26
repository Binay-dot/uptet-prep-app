# Content ingestion and reviewer queue

## Outcome
Real UPTET past-year questions get into the system as verified, ready-to-use
items. New AI-drafted questions (grounded in real PYQs/NCERT syllabus
material) go through a small review queue, used by a handful of named
reviewers, before they're usable — and even after approval, they start as
"calibration" items until enough real response data exists to trust their
difficulty.

## Why this matters
This is the guardrail against the two failure modes discussed while
scoping this app: (1) AI-generated exam content that's confidently wrong,
and (2) IRT difficulty parameters that were guessed instead of measured.
See `docs/decisions/0003-content-and-scoring.md`.

## Acceptance criteria
- Each question record has a status: `pyq_verified` (sourced from an
  official past paper + official answer key), `calibration` (approved by a
  reviewer but not yet enough response data to trust its difficulty), or
  `live` (enough response data collected; counts fully toward user ability
  estimates).
- Each question records: which paper/section it belongs to, its source
  (which past paper, or which syllabus topic it was drafted from), and —
  for AI-drafted items — which reviewer approved it and when.
- A `content_reviewer` role exists, distinct from ordinary student
  accounts. Reviewers can see and act on the review queue. They cannot
  access other students' personal data or accounts.
- The review queue shows, per pending item: the drafted question, its
  source material, and approve / edit-and-approve / reject actions.
- A rejected item is not deleted outright — kept with a rejection reason,
  so patterns in rejections can inform better drafting prompts later.
- PYQ import: a defined pipeline (doesn't have to be fully automated at
  first) turns official UPBEB PDF past papers plus their official answer
  keys into `pyq_verified` question records, tagged by year, paper, and
  section.
- An item moves from `calibration` to `live` only once it has been answered
  by enough users to compute a stable difficulty estimate (exact threshold
  is a tuning decision, not a hard number to nail down before building
  this — start conservative).

## Implementation notes
- Don't build a public-facing "submit a question" flow in v1 — the review
  queue is for your named reviewers only, not open contribution.
- The AI-drafting step (if built as an internal tool rather than a manual
  process) should always pass in the specific PYQ(s) or syllabus section
  being drafted from — never an open-ended "write a UPTET question" prompt.

## Tests
- A student account cannot reach the review queue endpoints, regardless of
  how the request is crafted.
- A `calibration` item's responses are recorded but do not affect any
  student's visible ability estimate.
- Rejected items don't appear anywhere in student-facing quizzes.

## Out of scope (for this feature)
- Automated OCR/scraping pipeline polish — a manual-but-documented process
  for the first batch of PYQs is fine to start.
- Reviewer-side analytics on their own review quality/throughput.

## Open questions
- Exact source and format for official PDFs (confirm current UPBEB
  publishing format before building an importer around assumptions).
