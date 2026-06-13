# UI Spec — Chunk 2 build target

One-page spec produced by the UI grill-me preceding Phase 3 chunk 2.
Chunk 2 builds against this; subsequent chunks (Seeds 5 → 2 → 3 → 4)
extend it. See `UI-DESIGN-DECISIONS.md` for provenance.

---

## Aesthetic system — Glean-aligned

- **Source of truth:** glean.com + Glean product surfaces (public
  marketing pages, any accessible screenshots of the admin console).
- **Extract before chunk 2:** palette (background, surface, text
  primary/secondary, accent, semantic colors), type (face, scale,
  weights), spacing scale, density, component patterns (buttons,
  cards, inputs, badges/pills, dividers).
- **Output:** a `tokens.ts` (or equivalent) committed before any UI
  code. Becomes the ground truth for "something's off" critique.
- **Light mode**, sans-forward, muted utility palette. Editorial
  patterns explicitly excluded.

## Page structure — single screen

- One screen. Input + output co-resident. Submit updates the output
  region in place. No route changes, no loading pages.
- Persistent framing line near the input (one sentence) stating what
  the system does.

## Component inventory

1. **Query input.** Free-text. Submit on enter or button click.
   Persistent framing line above or beside it.
2. **Example chips.** Clickable, alongside the input, visible by
   default. One chip per canonical scenario the system handles
   (Seeds 1–4 once those chunks land; Seed 5 is the
   refusal-protection canary). Click = populates the input and
   submits, or just populates — TBD in chunk 2 build (lean: just
   populate, let user submit, gives them control).
3. **Previous-verdict row.** Slim summary of the most recent prior
   query and its verdict. Persists across submits so the user can
   compare "did rephrasing change anything." Replaced (not appended)
   on next submit. Empty on first load.
4. **Diagnosis component.** V4 two-pane brief — locked from chunk 1.
   - Left pane (reasoning): retrieved docs, diagnosis, change log,
     gate signals fired.
   - Right pane (decision): verdict badge (resolve | escalate), owner,
     why, fallback.
   - Two states of one component: resolve vs. escalate is a verdict-pill
     flip on the same shape.
5. **Refusal component.** Same outer card shell as diagnosis (width,
   position, system treatment). Single-pane inner content: framed copy
   stating the scope perimeter + re-surfaced example chips.
6. **"How this decides" expandable.** Near the verdict in both
   diagnosis and refusal components. Closed by default. Opens to show
   the gate logic in plain language. Cheap to build (a `<details>` is
   fine for V1).

## Outcome architecture

| Verdict union value     | Component used       | Layout       |
|-------------------------|----------------------|--------------|
| `resolve`               | Diagnosis component  | Two-pane     |
| `escalate`              | Diagnosis component  | Two-pane     |
| `refuse_out_of_scope`   | Refusal component    | Single-pane  |

Same outer card shell across all three (Gestalt similarity at the
system-identity level). Inner layout diverges between diagnosis and
refusal (dissimilarity-on-purpose for kind-of-response).

## Trust scaffolding

- Persistent framing line near input (sentence-level statement of
  scope).
- Expandable "how this decides" near the verdict.
- Visible reasoning trace in the diagnosis component's left pane.
- Re-surfaced chips in the refusal component (one-click recovery
  path).

No modals. No separate routes. No onboarding step.

## Pre-chunk-2 prerequisites

1. Glean tokens extraction → `tokens.ts` (½ day).
2. Linear Phase 3 milestone created and SID-35 (chunk 1) attached.

## What this spec does NOT lock — deferred to later chunks

| Item                              | Defer to                |
|-----------------------------------|-------------------------|
| Loading state visuals             | Chunk 2 build           |
| Error states (API fail, malformed model output, retrieval empty) | Chunk 2 build, iterated through chunks 3–6 |
| Empty state (pre-first-query)     | Chunk 2 build (chips already cover most of this) |
| Mobile / responsive               | Chunk 7 (polish + deploy) |
| Input affordances (placeholder, autofocus, char limits) | Chunk 2 build |
| Animation, transitions, motion    | Chunk 7 (polish + deploy) |
| Multi-query history pane          | YAGNI for demo; reconsider only if Deepak feedback demands |

## Open question to raise with Deepak

The capstone rubric and deadline are still unconfirmed. Worth asking
before chunk 7 (deployment) commits to a finish line. Demo-completion
frame remains the safest read of "capstone done" until told otherwise.
