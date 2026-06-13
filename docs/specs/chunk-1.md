# Chunk 1 — Hand-craft Seed 1 + Validate the Ruler

## What this chunk produces

Two things, equally weighted:

1. **A trustworthy eval ("the ruler")** for the admin-diagnosis system, proven to work in both directions on one hand-authored scenario (Seed 1), before any diagnosis-system code is written.
2. **Two artifacts that show *why* the ruler is trustworthy** — the chunk-1 design decisions (written during the build, in real time) and `VALIDATION-NOTES.md` (written when validation passes). These are not documentation. They are the chunk's evidence that the work happened the way it claims to have happened.

A working ruler without the artifacts is the same failure mode this product is designed to prevent: a confident output with no shown work. The artifacts close that loop recursively.

**Done-criterion:**

- Ruler **passes** the good agent output (handcrafted to meet all four grading dimensions)
- Ruler **fails** the confidently-wrong agent output (handcrafted to fail root_cause + both binary judge calls; verdict passes by design)
- the chunk-1 design decisions exists with one entry per design question, **written at the time each decision was made** (not summarized after)
- `VALIDATION-NOTES.md` exists, capturing what was tested + why each result is correct

If any of these is missing, the chunk is not done.

## Why this comes first

Phase 1 §5 and Phase 4 plan: *validate the ruler before measuring with it.* If the eval can't catch a confidently-wrong output handcrafted to be wrong, every downstream number is a lie. Build the instrument before pointing it at the real diagnosis system.

## Scope discipline (do not balloon)

This chunk delivers:

- One scenario (Seed 1)
- One covering page in the reference library
- Two handcrafted agent outputs (good + confidently-wrong)
- A minimal eval that grades the four fields below
- Validation run that confirms the ruler behaves correctly on both outputs
- the chunk-1 design decisions — real-time provenance of the build's design choices
- `VALIDATION-NOTES.md` — substantive reasoning for why the validation run is trustworthy

It does **not** deliver:

- The diagnosis system (Phase 3 chunk 2+)
- Other seeds (Phase 3 later)
- The mutation engine (Phase 3 later)
- A full corpus (only the one covering page)

If the ruler validates, stop. The chunk is done.

## What's provided vs. what to build

**Provided (spec inputs — treat as read-only):**

```
chunk1/
  README.md                            ← this file
  scenario.json                        ← Seed 1: setup half + right-answer half
  reference-library/
    nested-group-inheritance.md        ← the covering page
  agent-outputs/
    good.json                          ← handcrafted correct output
    wrong.json                         ← handcrafted confidently-wrong output
  eval/
    .env.example                       ← ANTHROPIC_API_KEY goes here
```

**To build (this is the chunk's deliverable):**

A Node + TypeScript eval inside `eval/` that:

1. Loads `scenario.json` and an agent output JSON.
2. Grades the output on the four fields below (see Grading contract).
3. Has an entry point that runs the validation against both `agent-outputs/good.json` and `agent-outputs/wrong.json`, prints field-by-field results, and asserts the done-criterion.

**Plus two markdown artifacts at the chunk root:**

- the chunk-1 design decisions — built incrementally as design questions are answered (see "The artifact layer" below)
- `VALIDATION-NOTES.md` — written when validation passes (see "The artifact layer" below)

Stack: same as the meeting-prep agent (Node + TypeScript + Anthropic SDK + tsx + dotenv).

## What Claude Code should bring to Sid as a build decision

These are the design calls inside the eval. Don't make them silently — surface them, propose a default with reasoning, get Sid's call:

1. **File layout under `eval/src/`.** Single file? Split by concern? Where do the judge prompts live?
2. **Judge call structure.** One API call per criterion (clearer, more calls), or one call per output that emits both answers (cheaper, more parsing)? Sid's bias is toward the simpler/more-debuggable version unless cost is a real factor; at four total calls per validation run, cost isn't a factor.
3. **Parsing the judge response.** The judge is prompted to emit exactly "yes" or "no". What happens if it doesn't? Three options: (a) fail closed — anything not literally "yes" grades as fail; (b) retry once; (c) crash the validation run. Each has different implications for what the ruler's reliability means.
4. **Wrong-output validation: shape-check or binary?** The minimum done-criterion is "ruler fails the wrong output." A stricter check would assert *which* fields fail (verdict passes, root_cause fails, both judges fail). The stricter check catches the case where the ruler fails the wrong output for the wrong reason (e.g., verdict mismatched, hiding that a judge actually passed). Worth the extra few lines, or out of scope for chunk 1?
5. **Per-scenario judge prompts.** Each seed has its own pair of binary questions specific to its mechanism. How are these registered/looked up so Seed 2, 3, 4 plug in cleanly later? Don't over-engineer for one seed, but don't paint into a corner either.

## How to run validation (the contract — entry point name is Claude Code's call)

After the eval is built:

```bash
cd eval
cp .env.example .env
# add ANTHROPIC_API_KEY to .env
npm install
npm run validate   # or whatever entry point Claude Code defines
```

Expected output (exact format is Claude Code's call; the *information* is the contract):

```
[good]   verdict=PASS  root_cause=PASS  criterion_1=PASS  criterion_2=PASS  →  RULER PASSES ✓
[wrong]  verdict=PASS  root_cause=FAIL  criterion_1=FAIL  criterion_2=FAIL  →  RULER FAILS ✗ (correct)

Done-criterion: SATISFIED ✓
```

If either line doesn't match, the ruler is broken. Diagnose and fix the ruler — not the outputs, not the scenario.

## The artifact layer (the second half of the deliverable)

The chunk's purpose is not just "the ruler works." It is "the ruler works, AND I can show why anyone should trust the validation." Without the second half, the chunk has the same failure mode the diagnosis system is designed to prevent — a confident output that nobody else can verify.

Two artifacts. Both live at the chunk root (`Project/`).

### the chunk-1 design decisions — written *during* the build, not after

For each of the five design questions, add an entry to this file **at the moment the decision is made** — before moving to the next question. The point is real-time provenance: a reader can see the thinking happen, not a polished narrative reconstructed afterward.

Format per entry:

```
## Q[N] — [the question, verbatim]
**Options considered:**
- [option name]: [one-line summary]
- [option name]: [one-line summary]
- ...
**Decision:** [the chosen option]
**Reasoning:** [why this option, not the others — substantive, tied to the chunk's discipline. Cost / latency / accuracy explicit where they distinguish options; say so plainly when they don't.]
**What would change this decision:** [one line — what new information or constraint would push this another way]
```

This is non-negotiable. If Claude Code moves to the next question before writing the entry for the current one, the chunk is not on track. Sid will push back.

### `VALIDATION-NOTES.md` — written when the validation passes

Generated by (or immediately after) a successful validation run. Contains:

1. **What was tested** — the scenario, the two outputs, the four fields each
2. **What the ruler reported** — field-by-field, both outputs
3. **Why each report is correct** — substantive reasoning tying each PASS/FAIL to the underlying mechanism. Not "verdict passed because they matched." Closer to: *"verdict passes by design — both outputs resolve. The wrong output gets the decision right and the reason wrong; this is counter-case (a), which is what the ruler must catch via root_cause + judges, not via verdict."*
4. **What would invalidate this ruler going forward** — conditions under which today's PASS reading would no longer be reliable (judge wording changes, scenario edits, schema additions, judge-model change)

Length budget: ~1 page. If it sprawls past that, it is drifting into narrative. Cut.

### What NOT to include in either file

- Lessons learned
- Reflections
- Future improvements
- "What I learned about LLMs"
- Self-narration about the process

The discipline shows in the questions asked, the options weighed, the reasoning given, and the honest naming of what would change the decision. Anything beyond that slides into performative writing and weakens the artifact's credibility — exactly the way an over-confident agent output weakens its own.

## Grading contract (the four fields)

| Field | How graded | Source of truth |
|---|---|---|
| `verdict` | exact match against `expected_answer.verdict` | `scenario.json` |
| `root_cause` | exact match against `expected_answer.root_cause` | `scenario.json` |
| `diagnosis_text` — criterion 1 | binary LLM-judge | see "Judge questions for Seed 1" below |
| `diagnosis_text` — criterion 2 | binary LLM-judge | see "Judge questions for Seed 1" below |

**Pass rule for diagnosis_text:** flat AND — both criteria must answer "yes."

This is the binary-rubric discipline (notes 7.2.2 / 7.1.5): code-based exact-match on what has a single right answer; LLM-judge binary on what doesn't. No scalar scores anywhere.

## Judge questions for Seed 1

These two binary yes/no questions ARE the diagnosis_text grading contract. No reference paragraph to compare against. Wording is tight on purpose (calibration α from the Q7 grill-me) — see "Authoring discipline" below.

**Criterion 1 — mechanism identification:**

> *"Does the diagnosis identify that the user's actual group membership is in a nested subgroup that does not inherit access from the parent group? Answer yes or no."*

**Criterion 2 — operator reconciliation:**

> *"Does the diagnosis explicitly correct the operator's claim that they checked the user's group membership correctly — by naming both the group the operator checked AND the actual subgroup the user is a direct member of? Answer yes or no."*

Both must answer yes for the diagnosis_text field to pass.

The judge's system prompt should:
- Force binary output ("yes" or "no" only, no explanation)
- Set the bar at "clearly and specifically meets the criterion" — vague or partial fulfillment is no
- Use a recent Claude model (Sonnet 4 is fine; Sid's call)

## Authoring discipline already settled (don't re-litigate inside the chunk)

These were decided in the Phase 3 grill-me before writing the spec. They're locked.

- **Symptom (Q1)**: operator-typed with operator's claim deliberately wrong. The operator *thinks* they checked correctly; they didn't.
- **Reference library (Q2)**: one on-the-nose covering page. No decoys. (Decoys belong to mutations and to Seed 3.)
- **Status picture (Q3)**: truth-bearing facts only. No substrate, no clutter.
- **Change log (Q4)**: empty.
- **Expected diagnosis text (Q5)**: not pinned. Replaced by two binary judge questions at Q7.
- **Wrong output (Q6)**: confidently wrong on mechanism (timing, not non-inheritance) AND fails to correct the operator. No hedging, no fallback clauses, no escalation language. A clean confident wrong-resolve.
- **Judge wording (Q7)**: tight on mechanism direction (criterion 1 demands "nested subgroup that does not inherit"); criterion 2 demands both group names be cited in the correction.

The principle banked across these: *each scenario tests one mechanism at full strength and every other at zero. Added difficulty goes in mutations, one variable at a time — never baked into the spine.*

## Forward links (not in scope here, but flagged)

- The reference library will accumulate pages across seeds. The covering page authored here is reusable; no per-scenario re-authoring.
- The judge prompts are per-scenario (each seed has its own pair of binary questions specific to its mechanism). Phase 4 will need a registry mapping `scenario_id → judge prompts`.
- The canonical `root_cause` list will grow as seeds are added. For Seed 1, only `nested_subgroup_inheritance_gap` is the correct answer; `propagation_lag` is on the list so the wrong output has a canonical-but-wrong label to pick.
