# UI Design Decisions

Real-time provenance log from the UI grill-me preceding Phase 3 chunk 2.
Format inherited from chunk 1's `DESIGN-DECISIONS.md`: Question / Options
considered / Decision / Reasoning / What would change this decision.

---

## Q1 — Aesthetic system

**Question:** Which design system anchors the project — and serves as the
ground truth for "something's off" critique later?

**Options considered:**
- **A. Dark editorial.** DM Serif Display + DM Sans + JetBrains Mono,
  charcoal + amber accent. Pre-internalized from prior projects, fastest
  to build with.
- **B. Glean-aligned.** Light mode, sans-forward, muted utility palette
  extracted from glean.com. Requires authoring a mini-system before
  chunk 2 opens.
- **C. Material 3 / neutral.** Defensible by precedent (m3.material.io
  is referenced in the course material), fastest by tooling. Reads
  generic.

**Decision:** **B — Glean-aligned.**

**Reasoning:** Capstone doubles as outreach artifact for a specific
Glean role with 1:1 problem-space fit. The artifact is touchable and
demo-quality — a hiring manager opens it and registers brand-system
fluency in the first second. Visual mimicry is load-bearing for the
outreach signal, not a distractor on top of the architectural fit.
C reads as "didn't think about Glean specifically." A is opinionated
but off-brand for the audience that matters most. The system-authoring
tax (~½ day to extract glean.com's palette, type, density, component
patterns into a tokens file) is the cost of the outreach signal, not
overhead.

**What would change this decision:**
- Audience pivot away from Glean (e.g., capstone shown only to AIPM
  cohort, no outreach use).
- Discovery that Glean's visual language is so distinctive a partial
  mimic reads worse than no mimic.
- Q2 IA forcing dense scanning surfaces Glean's system can't carry
  (low risk — Glean's system is admin-console-shaped already).

**Queued for chunk 2 prereq:** Extract Glean's design system from
glean.com + their product surfaces into a tokens file (palette, type
scale, spacing, component patterns, density). Done before any chunk-2
UI code is written.

---

## Q2 — Information architecture

**Question:** What's on the page, in what hierarchy?

**Decision (four facets):**

**(a) Page structure:** **Single screen, updates in place on submit.**
Multi-step (input → loading page → output page) breaks the admin-console
metaphor and adds navigation cost. Stage-1 users benefit from the input
staying visible alongside the verdict so they can read their query
against the answer — a trust mechanic multi-step would lose.

**(b) Example queries:** **Clickable chips, alongside the input,
visible by default.** Three jobs at once — defeat blank-page paralysis
(stage-1 abandonment is permanent), communicate scope without docs,
and demo-protect by giving hiring managers a one-click path to
canonical scenarios. A "see examples" button is one click too many; an
onboarding step gates the demo behind a screen no one wants.

**(c) Session history:** **Fresh slate by default, but the previous
verdict persists as a slim summary row visible alongside the next
query.** Full session history is admin-console-correct but YAGNI for
stage-1/2 demo users. What's load-bearing is the ability to tweak a
query and see whether the answer changed — one previous run gives that
without building a history pane.

**(d) Trust-building content layer:** **One line of persistent framing
near the input + one expandable "how this decides" link near the
verdict.** No modal (stage-1 users dismiss without reading). No
separate page (no one clicks "About"). Trust is built where the
verdict lives, not on a separate route.

**Reasoning:** All four answers cluster around the same principle:
stage-1/2 trust is built by keeping the work visible and the next
action obvious. Anything that hides, gates, or interrupts costs
abandonment.

**What would change this decision:**
- Discovery during chunk 2 build that the diagnosis component plus the
  previous-verdict row plus chips overflows the viewport on standard
  laptop screens (forces reconsideration of (b) chip placement or (c)
  history pin).
- Deepak feedback that the demo needs to show multi-query investigation
  flow more explicitly (forces upgrade of (c) from one-row pin to
  proper history pane).

---

## Q3 — Resolve / escalate / refuse: same component, or split?

**Question:** Three outcome types exist (resolve, escalate, refuse).
Architecturally, are they one component with three states, or a
diagnosis component (resolve + escalate) plus a separate refusal
component?

**Options considered:**
- **A. Same component, three states.** Strong Gestalt similarity
  ("all three are the system's response"). Simpler implementation.
  Risk: refusal reads as failed diagnosis.
- **B. Diagnosis component + separate refusal component.** Gestalt
  dissimilarity-on-purpose. More UI surface to design.

**Decision:** **B — split, with refusal sharing the outer card shell
but using a single-pane inner layout.**

**Reasoning:** Resolve and escalate fill the same fields (root cause,
owner, diagnosis text, reasoning trace, gate signals); the verdict is
a binary flip on the same content shape. Refusal fills none of those
fields — there is no root cause, no owner, no diagnosis. Forcing
refusal into V4's two-pane structure produces a hollowed-out shell
(five empty fields, one verdict line) that stage-1 users read as "the
system tried and failed," which is the opposite of the intended
signal. Refusal is a category boundary, not a failed diagnosis — and
Gestalt dissimilarity-on-purpose is exactly the tool for that. The
shared outer shell preserves system-identity (both surfaces are
obviously the system speaking); the divergent inner content delivers
the kind-difference in the first half-second.

**Refusal component shape:** Same outer card footprint as diagnosis
(width, position, Glean-system treatment). Inner content is
single-pane: framed copy explaining the scope perimeter
(e.g., "this looks outside what this system handles — it checks group
inheritance and permission routing issues") plus re-surfacing of the
example chips for a one-click path back to in-scope.

**What would change this decision:**
- Chunk 3 build reveals refusal content is more varied than expected
  (e.g., different refusal reasons need different framing copy),
  forcing the refusal component into multi-state itself. Doesn't
  invalidate the split — strengthens it.
- A discovered constraint that the diagnosis component's two-pane
  layout is doing identity-work the refusal component absolutely must
  inherit (weak — one demo, identity-by-layout isn't at stake).

---

## Discipline carry-over from chunk 1

- **Facts owned by code, judgment owned by author.** Tokens extracted
  from glean.com (Q1 prereq) are mechanical. Copy in the framing line,
  the refusal explanation, and the "how this decides" expandable is
  authored, not generated.
- **Course deviations acknowledged.** None in this grill-me. All three
  decisions trace cleanly to Gestalt + DOET + Power-Law-of-Learning
  principles in the Week 7 synthesis.
- **Real-time provenance.** This file is the provenance. Written at
  decision time, not summarized after.
- **Disjointness.** Each question tested one mechanism. Q1 = ground
  truth for critique. Q2 = page hierarchy. Q3 = outcome architecture.
  No mechanism baked into multiple questions.
