# 0004 — Fall back to reputable third-party PYQ reproductions, tagged honestly

## Context
0003 named official UPBEB PDFs (published at updeled.gov.in) as the
primary content source, and explicitly rejected third-party coaching
sites' reproductions as the primary source, on the grounds that a wrong
answer key circulating from an unverified source could break trust in
the app entirely.

Attempting to source the first real batch of content (2026-09-28)
confirmed a real access problem, not a preference: updeled.gov.in only
publishes each cycle's answer key on a temporary, cycle-specific page
(objection window -> result), then closes it — there is no permanent
public archive of past papers/keys on the official site. This matches
0003's own "Conditions for revisiting" clause almost exactly ("If
official PDF sourcing proves impractical (format changes, access
issues), revisit with a documented reason").

## Decision
For the first real content batch:
1. Source real historical UPTET questions from reputable, well-established
   coaching/prep platforms (e.g. adda247, PW) instead of an official PDF,
   since those platforms host past papers with their own stated answer
   keys and are the closest practical substitute.
2. **Never mark third-party-sourced content `pyq_verified`.** It goes in
   as `source: "pyq"` (it genuinely is a real past-year question, not
   AI-drafted) but `status: "calibration"` — i.e. it is treated exactly
   like an unverified new item and must earn its way to counting toward a
   student's visible ability estimate via real response data, same as any
   other unverified item (see docs/architecture.md, questions.status).
   `pyq_verified` is reserved for content cross-checked against an actual
   official answer key.
3. Each such question's `sourceNote` records which third-party site and
   page it came from, so provenance is traceable and re-verifiable later.
4. If/when an official PDF for the same year becomes available (e.g. the
   person running this product has a saved copy from when it was live,
   or a permanent official archive is found), re-verify and promote the
   matching questions to `pyq_verified`.

## Reasoning
This keeps 0003's actual safety property (never silently trust unverified
content) while unblocking the product — the honest status label
(`calibration`, not `pyq_verified`) is what does the safety work, not the
source label. A `calibration` item cannot affect anyone's visible ability
estimate until real response data promotes it (see
docs/features/001-quiz-and-score-prediction.md acceptance criteria).

## Conditions for revisiting
Re-verify and promote to `pyq_verified` (or replace) any item once an
authoritative official source for the same year/paper becomes available.
