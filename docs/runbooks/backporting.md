# Backporting: keeping the factory alive

The factory only stays useful if it actually absorbs what you learn while
building real products. This is the habit that makes that happen, not a
one-time setup step.

## The rule of thumb
Before closing out a chunk of work on any product built from this
template, ask: **"did I just build something every future product would
also need, in roughly the same shape?"**

Examples of "yes, backport it":
- A working auth setup (signup/login/session handling) that isn't specific
  to this product's domain — belongs in the template's base scaffold.
- A useful `doctor` script check that would have caught a real setup
  problem, added generically (not "check for UPTET's database" but "check
  that .env has all required keys").
- A reusable UI pattern (a quiz-question component, a results screen
  layout) that's genuinely generic, not tied to UPTET's specific content.
- A security or data-modeling pattern that fixed a real bug — this is
  exactly what `advisories/` is for.

Examples of "no, keep it in the product":
- Anything about UPTET's specific exam structure, sections, or content.
- Product-specific UI branding, copy, or domain logic.
- A one-off decision this specific product needed (write an ADR in the
  product's own `docs/decisions/` instead).

## How to actually do it
1. Note it in the product's own `docs/feedback/lessons.md` as you go — a
   one-line note is enough, don't interrupt the work to do this formally.
2. Periodically (end of a feature, not every commit), review that file and
   pull the generic pieces back into this factory repo:
   - A fix or hardening → `advisories/`, with a short note on what broke
     and what changed.
   - A capability worth offering to future products, but not mandatory for
     all of them → `recipes/`.
   - Something that should just be the new default for every product going
     forward → update the template files directly, and bump
     `template.json`'s version.
3. Existing products don't auto-update. If an advisory is serious enough to
   backport into already-shipped products, do that as a deliberate,
   reviewed change to that product — not a silent template sync.

## Why this matters more than it seems
Skipping this doesn't fail loudly. It fails quietly: six months and three
products later, you notice you're solving the same auth bug for the third
time, because the fix only ever lived in one product's code and never made
it back here.
