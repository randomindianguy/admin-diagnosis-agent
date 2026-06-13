# Design Decisions — Chunk 1 (Validate the Ruler)

Real-time provenance. One entry per design question, written when the decision was made.

## Q1 — File layout under `eval/src/`. Single file? Split by concern? Where do the judge prompts live?

**Options considered:**
- Split by concern + structured result: `types.ts` / `judges.ts` / `grade.ts` / `validate.ts`; `grade.ts` returns a structured `GradeResult` (per-field PASS/FAIL) that is the single source for both the console printout and `VALIDATION-NOTES.md` §1–2.
- Split by concern, console-only: same four files, but the run only prints; the whole notes file is hand-transcribed from console output.
- Single `index.ts`: orchestration, grading, and judge prompts in one file.

**Decision:** Split by concern + structured result. Judge prompts live in `judges.ts` (registry keyed by `scenario_id`; exact shape settled in Q5).

**Reasoning:** Cost and latency do not distinguish these options — it is a structural choice with no runtime difference, and all three make the same four API calls. The distinguishing axis is the *drift surface* in `VALIDATION-NOTES.md`. That artifact's whole job is to be trustworthy; its §1–2 (what was tested, what the ruler reported) are *facts about the run*. If those facts are hand-transcribed from printed console text, a drift surface is inserted into the one artifact designed to be drift-free — the same failure mode the chunk exists to prevent, one layer up. Having both the console output and §1–2 derive from a single `GradeResult` object takes that drift surface to zero. §3 (why each result is correct) and §4 (invalidation conditions) stay hand-authored because they are judgment, not facts. Splitting `judges.ts` out also keeps the per-scenario prompt registry (Q5) from being retrofitted into grading logic later.

**What would change this decision:** If the artifact layer were dropped from scope (no `VALIDATION-NOTES.md`) and the eval were guaranteed to stay single-seed, the structured-result justification weakens and a single file would suffice.

## Q2 — Judge call structure: one API call per criterion, or one call per output that emits both answers?

**Options considered:**
- One call per criterion: 2 calls per output, 4 per validation run; each call asks one criterion and emits one yes/no.
- One call per output: 2 calls per run; one prompt asks both criteria and emits both answers.

**Decision:** One call per criterion.

**Reasoning:** Cost and latency are flat between the options (4 vs 2 trivial calls; the README already rules cost out at this scale), so the deciding axis is accuracy and clean data flow. Putting each criterion in its own context window stops the model from averaging across two yes/no judgments in a single prompt, which preserves the binary discipline. And per Q1, the combined call entangles both answers in one response — forcing a split-and-re-attribute step in code, i.e. a parse/attribution surface in the data that feeds the trust artifact (the drift failure mode Q1 eliminated). One call → one criterion → one field maps cleanly.

**What would change this decision:** If criteria-per-scenario × scenarios grew large enough that 2× the call count became a real cost or rate-limit factor, the combined call's savings would be worth re-weighing — not a factor at chunk-1 scale.

## Q3 — Parsing the judge response: the judge is told to emit "yes"/"no". What if it doesn't — (a) fail closed, (b) retry once, (c) crash the run?

**Options considered:**
- Strict parse, fail loud (c, normalized): trim/lowercase/strip a trailing period, accept only `yes`/`no`, otherwise throw with the raw response and halt.
- Fail closed (a): anything not `yes` grades as fail.
- Retry once (b): re-call on a malformed response, then fall back to crash/fail-closed.

**Decision:** Strict parse, fail loud.

**Reasoning:** Cost and latency are flat; accuracy is the axis. Fail-closed conflates "the judge malfunctioned" with "the criterion was not met," which hides a broken judge — and on the wrong output, where FAIL is the expected direction, it greens the done-criterion for the wrong reason. The artifact layer sharpens this: that same conflation then propagates into `VALIDATION-NOTES.md` §3, which would assert substantive reasoning ("fails criterion 2 because…") about what was actually a parse failure — the trust artifact lies. Retry adds nondeterminism to an instrument being calibrated now; crashing is the only option that refuses to grade what it cannot read.

**What would change this decision:** At scale (the real diagnosis system, hundreds of scenarios), transient malformed responses across many calls could justify retry-then-fail-closed for throughput — a resilience goal, distinct from chunk-1's calibration goal.

## Q4 — Wrong-output validation: assert which fields fail (shape-check), or just that it fails overall (binary)?

**Options considered:**
- Per-field shape-check: assert each field for both outputs (`good`: all PASS; `wrong`: verdict PASS, root_cause/c1/c2 FAIL).
- Binary overall: assert only that `good` passes and `wrong` fails.

**Decision:** Per-field shape-check.

**Reasoning:** Cost and latency are flat; accuracy is the axis. Because verdict passes by design, a binary check greens whenever the wrong output fails for *any* reason — so it would hide whether `root_cause` actually caught the confident-wrong, certifying a ruler weaker than it looks (the same recursive failure mode as Q3, one layer up). The artifact layer makes this structural rather than a tightness preference: `VALIDATION-NOTES.md` §2 (field-by-field report) and §3 (per-field reasoning) are per-field by construction, and a binary check generates no per-field data for the trust artifact to populate from. The README's own "Expected output" is already a per-field shape, so this asserts the contract, not extra scope.

**What would change this decision:** If the artifact layer were dropped and the only deliverable were an overall "does the ruler separate good from wrong" bit, the binary check would suffice — not the case here.

## Q5 — Per-scenario judge prompts: how registered/looked up so Seeds 2–4 plug in cleanly?

**Options considered:**
- `scenario_id` registry + drift guard: `Record<scenario_id, {key,prompt}[]>` in `judges.ts`; `scenario.json` owns which-criteria + pass_rule; lookup fails loud on missing scenario; one pass rule (`all_must_pass`); PLUS assert the registry's criterion keys match the scenario's declared `criteria` keys.
- `scenario_id` registry, no guard: same, without the key-match assertion.
- Inline prompts in `grade.ts`: hardcode seed-1's two prompts at point of use.

**Decision:** `scenario_id` registry + drift guard.

**Reasoning:** Cost and latency are flat (~3 extra lines for the guard). Prompt wording is registered per `scenario_id` because it is seed-specific, while `scenario.json` stays the source of truth for which criteria apply and the pass rule; lookup throws on a missing scenario, consistent with Q3's fail-loud stance. The artifact layer makes the guard definitive rather than optional: `VALIDATION-NOTES.md` §4 names scenario/schema/judge drift as the conditions that invalidate the ruler, so if §4 asserts drift is the invalidator and the code doesn't enforce against it, the trust artifact is promising a guarantee the code can't keep — documented-but-unenforced is worse than silence. The guard makes §4's claim a runtime invariant. It is still not over-engineering: no rule DSL, one implemented pass rule, a plain-object registry.

**What would change this decision:** If the criteria list and output schema were frozen across all future seeds, the guard would be redundant — unrealistic, since seeds are authored by hand and key typos / scenario edits are the most likely future mistake.

## Q6 — Judge model + call params (README left this to Sid's call)

**Options considered:**
- Model: `claude-sonnet-4-6` (recent, cheap Sonnet) / `claude-opus-4-8` (strongest) / `claude-haiku-4-5` (cheapest).
- Call params: no `temperature` + no `thinking` / `temperature: 0` for determinism / adaptive thinking on.

**Decision:** `claude-sonnet-4-6`, with **no `temperature` and no `thinking`**, and a small `max_tokens` (~5).

**Reasoning:** The README names Sonnet ("Sonnet 4 is fine"); the current equivalent ID is `claude-sonnet-4-6` (there is no bare `claude-sonnet-4`), and a recent mid-tier model is the right fit for a tightly-worded binary classifier — cost is flat at four calls, so the choice is about adequacy, not price. Thinking is omitted because a binary yes/no judge wants no reasoning preamble. `temperature` is omitted deliberately for **portability**, not by oversight: omitting sampling params keeps the ruler swappable to a no-sampling model (Opus 4.8 / 4.7 / Fable 5 return 400 on `temperature`), and hard-coding `temperature: 0` would be a latent footgun on a later model swap. Determinism is not load-bearing here — Q3's strict parse already absorbs output-format variance, so `temperature: 0` would buy little while costing portability.

**What would change this decision:** If the judge disagreed with hand-labels on the golden set (too weak for the calibration the criteria demand), escalate the model tier to Opus; a model swap needs no other code change, which is the point of leaving sampling params off.

**Cross-validation:** Deviates from the "most sophisticated judge" default (course note 7.2.1) deliberately — the task is binary token-checking against named entities, not open-ended quality judgment. Cross-validated against `claude-opus-4-8` with full agreement on all four judge calls; Sonnet retained for cost.

## Q7 — Judge explainability column: should the judge emit reasoning alongside the binary label?

**Options considered:**
- Binary label only: the judge returns just `yes`/`no` (the chunk-1 shipped state before this change).
- Binary label + supplementary reasoning: the judge returns `yes`/`no` on the first line, then 1–2 sentences of reasoning, captured but not graded.
- Reasoning folded into the grade: parse the reasoning and let it influence the pass/fail (rejected on sight).

**Decision:** Binary label + supplementary reasoning, **audit-only**. First line is strict-parsed for `yes`/`no` (Q3 unchanged); the reasoning is captured into `GradeResult` and surfaced in `VALIDATION-NOTES.md` §2, but never read by grading logic.

**Reasoning:** This is the canonical application of the binary-rubric rule, not a violation of it — course tip 7.2.2 #2 ("Tips on Building LLM as a Judge") calls for a binary label *and* a reasoning column precisely so that when the judge surprises you, you can see *why* it called what it called. The grade stays a single bit decided by exact `yes`/`no`; the reasoning is a separate, ungraded audit trail. Keeping the two strictly separated is what preserves the discipline: the moment reasoning text feeds the score, the rubric stops being binary and calibration becomes unauditable. Cost is immaterial (the reasoning adds output tokens on four calls; `max_tokens` rises from ~5 to ~200), and the only structural change is `judgeRaw` widening from a raw string to `{answer, reasoning}` per criterion.

**What would change this decision:** If the reasoning text were ever used for scoring (parsed, thresholded, or fed back into pass/fail), the binary discipline would be violated and this decision would have to be reversed — the column is audit-only by construction, and must stay that way.

## Q8 — Re-run-safe notes writer: how does regenerating §1–2 avoid clobbering hand-authored §3–4?

**Options considered:**
- Full overwrite each run: `writeValidationNotes` rewrites the whole file including §3–4 stubs (the chunk-1 shipped state — fine for a one-shot run, destructive on re-run).
- Preserve-on-re-run, silent fallback: regenerate §1–2, carry §3-onward over if found, but stub §3–4 if the boundary marker is absent.
- Preserve-on-re-run, fail loud: regenerate §1–2, carry §3-onward over from a named boundary constant, and **throw** (no write) if an existing file lacks that boundary.

**Decision:** Preserve-on-re-run, fail loud. The writer regenerates §1–2 from the structured `GradeResult`, and when `VALIDATION-NOTES.md` already exists it splices everything from `NOTES_PRESERVE_BOUNDARY` (`"## 3."`) onward verbatim. If the marker is missing, it throws with a clear message and writes nothing.

**Reasoning:** This decision surfaced during implementation, not design — but it is the structural enforcement of Q1, not a new principle. Q1 stated "code owns facts, human owns judgment"; the original full-overwrite writer *stated* that split but didn't *enforce* it across re-runs, so the first re-run after §3 was hand-authored would have silently eaten it. Splicing at a named boundary makes the facts/judgment split a runtime invariant. The fail-loud branch carries the Q3 discipline one layer up: a missing boundary means the writer cannot locate the prose it must preserve, and silently stubbing §3–4 (option 2) would be the same "couldn't read it, so I'll quietly overwrite" failure mode Q3 rejects — so it refuses and never half-writes.

**What would change this decision:** If §3–4 were moved out of `VALIDATION-NOTES.md` into a separate hand-authored file, the splice would be unnecessary and the writer could own its whole file again — at the cost of splitting one trust artifact into two.
