# Product

## What is this app?
A quiz-based practice platform for UPTET (Uttar Pradesh Teacher Eligibility
Test) aspirants. Its one job, done well: tell a candidate how ready they
actually are for the real exam — a predicted score and section-wise
strengths/weaknesses, based on a real IRT ability estimate, not a raw
percentage of questions answered correctly.

## Who is it for?
Individuals preparing for UPTET Paper 1 (Classes I–V) and/or Paper 2
(Classes VI–VIII), studying largely on their own or alongside a small
circle of friends — not coaching institutes or schools (that's a possible
future "Corporate/Institution" tier, not v1).

## The exam this is built around
- Conducting body: UPBEB (UP Basic Education Board)
- Two papers, each 150 questions / 150 marks, 2.5 hours, **no negative
  marking**, all MCQ (4 options)
- Paper 1 sections: Child Development & Pedagogy, Hindi, English/Sanskrit/
  Urdu (candidate picks one), Mathematics, EVS — 30 questions each
- Paper 2 sections: Child Development & Pedagogy, Hindi, English/Sanskrit/
  Urdu, and Math & Science *or* Social Studies (candidate picks a track) —
  30 questions each
- v1 covers **both papers**, one language track (English) and one Paper 2
  specialization track (Social Studies) to start — Sanskrit/Urdu and the
  Math & Science track are additive later, not blocking launch.

## Core workflows (MVP)
1. **Sign up, pick which paper(s) you're preparing for.**
2. **Take a practice quiz** — by section or a full mock — drawn from the
   question bank (real UPTET PYQs plus reviewed AI-drafted items).
3. **See a score/readiness prediction after every quiz**: a predicted score
   out of 150 for the real exam, plus a per-section breakdown (which
   sections are strong, which need work), driven by an IRT ability
   estimate — not just "you got 22/30."
4. **Add friends and see a small leaderboard among them**, and challenge a
   specific friend to a quiz on a chosen section. This is a light layer on
   top of the same real content and scoring — not a separate game mode, and
   not open matchmaking against strangers in v1 (deliberately deferred —
   see `docs/decisions/`).
5. **(Internal, not student-facing)**: a small number of named content
   reviewers can review AI-drafted questions in a queue before they go live
   as real (or calibration-only) items.

## Explicitly out of scope for v1
- Open "random opponent" matchmaking (needs real concurrent user volume
  first — see `docs/decisions/0002-social-layer.md`)
- Sanskrit/Urdu language tracks, Math & Science track for Paper 2 (add once
  English/Social Studies tracks are proven)
- Institution/corporate licensing tier
- Parent/guardian features, offline mode, push notifications beyond the
  basics

## Where the full PRD/feature list lives
Your friend's original feature spreadsheet (`Quiz_Final_Feature.xlsx`) was
reviewed and is treated as inspiration, not a spec — most of its
gamification features (tournaments, spin wheel, leagues) are deliberately
NOT part of this build; see the review notes earlier in this project's
history for why. The actual scope for this app is what's written in this
file and in `docs/features/`.
