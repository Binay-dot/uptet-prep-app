# Current work

Status: product scope decided; no code written yet.

## Completed
- Reference architecture decided (docs/architecture.md, decisions/0001)
- Product defined: UPTET practice/prediction app, both papers, English +
  Social Studies tracks first (docs/product.md)
- Three feature specs written:
  - 001: quiz + score/readiness prediction (the core feature — build first)
  - 002: content ingestion + reviewer queue
  - 003: friends + friend-scoped leaderboard/challenge
- Two ADRs recorded: deferring open matchmaking (0002), content sourcing
  and IRT calibration approach (0003)

## Next
1. Scaffold the actual code (apps/web, apps/mobile, packages/*) per
   docs/architecture.md.
2. Get auth working end-to-end first (everything else depends on it).
3. Build feature 001 (quiz + prediction) before anything else — it's the
   product's entire reason to exist.
4. Source the first batch of real UPTET PYQs (official UPBEB PDFs) to seed
   the question bank before worrying about AI-drafted content.
5. Design the UI for the core quiz-taking and results screens (Design
   artifact) once 001's data shape is settled enough to mock against.

## Verified
Nothing run yet — no code exists.

## Blockers
None currently. Open item to resolve before feature 002 is fully buildable:
confirm current format UPBEB publishes past papers/answer keys in.
