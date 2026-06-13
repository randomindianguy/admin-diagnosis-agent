# Retrofit Design Decisions — SID-42 (Chunk 1, seed-and-mutate grader validation)

Real-time provenance for the chunk-1 retrofit. One entry per design question,
written when the decision was made. Same format as the chunk-1 design decisions and
the chunk-2 design decisions: Question / Options considered / Decision /
Reasoning / What would change this decision.

The retrofit applies the course's seed-and-mutate technique (5.3.3) and
disagreement-rate methodology (5.3.1, 7.1.5) to push the chunk-1 ruler against
more than the two hand-authored anchors it was originally validated on. The
VALIDATION-NOTES §4 caveat "Calibration relies on single-labeler authoring
(Sid); the course-taught <10% disagreement-rate-across-labelers methodology
will need ≥10 outputs and 2–3 labelers to apply meaningfully" is what this
retrofit addresses, with one substantive adaptation (Q1 below).

---

## Q1 — Translating multi-labeler disagreement-rate to single-labeler reality

**Options considered:**

- **A. Literal multi-labeler triangulation.** Sid + at least one other human labeler grade each mutation independently; disagreement rate is computed across the human labelers per the course's 5.3.1 method, target <10%.
- **B. Author-intent vs. ruler-grade comparison.** Sid pre-labels each mutation's expected grade per dimension (acting as the intent author). The ruler is run against each mutation. Disagreement = ruler's grade differs from Sid's labeled intent.
- **C. Disagreement-rate framing dropped entirely.** Run the ruler over mutations as a smoke test; no formal labeled-intent comparison.

**Decision:** B — author-intent vs. ruler-grade.

**Reasoning:** A is the course-default but isn't available at chunk-1 scale (team-of-one capstone, no second human labeler to enlist). C abandons the discipline the retrofit was created to apply. B preserves the substance of the course's framing — a known label compared against an automated grade — while adapting to the available labeler structure. The ruler itself is the artifact being validated; an author-intent comparison is the right shape for "does the artifact behave as I designed it to." Cost / latency are flat across all three; the deciding axis is which framing actually applies given the labeler constraint.

**Named course deviation:** The course's <10% target absorbs noise across multiple human labelers. With one labeler-author and a code+judge ruler, "noise" is replaced by either ruler bugs or mutation ambiguity — both of which call for investigation rather than absorption. The disagreement-rate metric is still computed (for continuity with the course framing and for the rate's diagnostic value across re-runs), but the done-criterion bar is set differently at Q2.

**What would change this decision:** A second human labeler becoming available — at which point the framing extends from "author vs. ruler" to "two humans vs. ruler" without invalidating B's structure (Sid's intent labels remain the spec; the second labeler is a check on the spec itself).

---

## Q2 — Done-criterion: how strict?

**Options considered:**

- **A. Course default — <10% disagreement rate.** Pass if fewer than 10% of grading cells disagree across all mutations.
- **B. Strict — 100% agreement post-investigation, ≤1 mutation dropped.** Every disagreement gets investigated. Either the ruler has a bug (fix the ruler) or the mutation is genuinely ambiguous (drop it, name it in VALIDATION-NOTES §5). Cap the dropped count.
- **C. Per-dimension split.** 100% on the mechanical dimensions (verdict, root_cause — exact-match), <10% on the judge dimensions (c1, c2 — LLM-graded).

**Decision:** B.

**Reasoning:** The 10% noise absorption in the course's framing makes sense for human labelers, whose disagreement is irreducible at scale. The ruler isn't noisy — it's deterministic on the mechanical dimensions and constrained-stochastic on the judge dimensions (Sonnet 4.6, no temperature, strict first-line parse). When the ruler disagrees with author intent on a clear case, that is either a real bug to fix or a mutation that was unclear enough to drop. Absorbing it into a 10% budget loses the signal the retrofit is trying to surface. C is the implicit hybrid B already encodes — the mechanical-dimension floor is structural (100% by construction in B's strict framing); the judge dimensions are where any genuine ambiguity could appear, and that's where investigation is the right response, not absorption.

**Cap on dropped mutations:** ≤1 of the ~10 mutations. More than that and the mutation generation itself is the issue, not the ruler.

**What would change this decision:** Scaling to dozens of mutations across many seeds (multi-seed retrofit), at which point per-mutation investigation cost dominates and the looser <10% threshold becomes pragmatically necessary. Not the case at chunk-1 scale.

---

## Q3 — Generation method

**Decision:** Inherited from the chunk-3 Q4 working answer locked in the handoff: Claude generates mutations in one pass, Sid reviews and prunes. No re-litigation; same generation discipline.

**Forward link:** If a mutation is dropped under Q2's strict bar, the drop is named in VALIDATION-NOTES §5 with the reason. The dropped mutation isn't regenerated — the goal is to surface ambiguity, not to paper over it.

---

## Q4 — Implementation location

**Decision:** Sibling runner `eval/src/validate-mutations.ts`. Inherited from chunk-2 design decisions Q17.

**Reasoning:** Q17's pattern was chosen precisely to handle "running the ruler on something other than good.json + wrong.json without modifying the fenced grader file." This is the second such case (chunk-2 system output was the first); same constraints, same shape, no reason to deviate. The runner imports `gradeOutput`, `JUDGE_MODEL`, and the types from the unchanged grader files; loads mutation outputs from `agent-outputs/mutations/`; reads expected grades from a manifest; prints results in a format consistent with chunk-1's validation log.

**What would change this decision:** Running this across many seeds and chunks would justify promoting the pattern to a first-class CLI arg on `validate.ts` (option B from chunk-2 design decisions Q17). For two sibling cases (chunk-2 system output + this retrofit), the sibling-runner pattern still wins.

---

## Q5 — Mutation axes (which dimensions to vary)

**Options considered:**

- **A. Phrasing-only paraphrases.** Multiple reworded versions of good and wrong; tests ruler invariance to natural language variation.
- **B. Per-dimension failure-mode coverage.** A mutation for each grading dimension's isolated failure: c1-only fail, c2-only fail, verdict-only fail, root_cause-only fail. Plus paraphrases for invariance.
- **C. Course-method coverage.** One mutation per method named in 5.3.3 (paraphrase, back-translation, self-instruct, etc.).

**Decision:** B, with a small set of A-style paraphrases retained for invariance.

**Reasoning:** A alone tests invariance but doesn't stress-test the ruler's discrimination — it can't surface a bug where the ruler conflates one dimension with another. C is structured around method-coverage rather than failure-mode-coverage; for a validation retrofit, what matters is whether the ruler discriminates each grading dimension correctly across the surface area of likely failure modes, not whether every synthesis method is represented. B follows the chunk-2 disjointness principle directly applied to grading dimensions: each axis tests one dimension's failure mode at full strength with the others held constant. Method-wise, this naturally lands as paraphrasing (5.3.3 method 2) carrying axes 1–2 and targeted partial-fulfillment authoring carrying axes 3–7. Back-translation (method 3) deliberately skipped — adds nothing distinct over paraphrasing at chunk-1 scale and burns mutation budget.

The seven axes (locked in the design grill-me, expanded into ten mutation files):

| Axis | Tests | Carried by |
|---|---|---|
| 1 | Ruler invariance to paraphrasing of correct answers | m01, m08, m09 |
| 2 | Ruler invariance to paraphrasing of wrong answers | m02 |
| 3 | c1-only pass (mechanism named, both groups not named) | m03 |
| 4 | c2-only pass (groups named, wrong mechanism in text) | m04 |
| 5 | Both judges fail with correct label (label/text incoherence on the failure side) | m05 |
| 6 | Verdict-only fail | m06 |
| 7 | Different wrong canonical-shaped label | m07 |
| edge | Mentioned-but-rejected mechanism (judge "clearly and specifically" bar) | m10 |

**Note on m04 / m05 — label/text incoherence held constant:** Both mutations keep `root_cause` at the correct label even though the diagnosis text is wrong on mechanism. This is deliberate — the ruler grades label and text independently, and these mutations isolate the text-only failure to the judge dimensions without dragging the root_cause check into the failure set. Tests the thesis from chunk-1's design directly: the ruler isn't fooled by a correct label paired with wrong text.

**Note on m10 — the disagreement candidate:** The "mentioned-but-rejected" mutation deliberately exercises the judge prompt's "CLEARLY AND SPECIFICALLY meets the criterion" bar (`judges.ts` JUDGE_SYSTEM_PROMPT). The right mechanism is named but rejected as a hypothesis in favor of the wrong one. Intent: c1 should fail (the mechanism is not identified; it's mentioned and discarded). Flagged in advance as the most likely source of a genuine judge ambiguity. If the ruler disagrees here, the disagreement is informative — it's pointing at the judge's interpretation of "clearly and specifically," not at a ruler bug.

**What would change this decision:** Discovery during a re-run that the seven-axis coverage misses a failure mode that real chunk-2+ system outputs exhibit. Additive — would add the missing axis as a new mutation and re-run, not invalidate the existing set.

---

## Q6 — Expected-grade storage

**Options considered:**

- **A. Sibling expected-grade files.** Each mutation has a paired `m0X.expected.json`. Clean separation, no schema change to AgentOutput.
- **B. Inline metadata on the mutation file.** Each mutation carries an `_expected` field the grader strips before grading. Single file per mutation, but pollutes the AgentOutput shape.
- **C. Single manifest.** `agent-outputs/mutations/expected-grades.json` maps filename → expected grade vector → axis label → rationale.

**Decision:** C.

**Reasoning:** The manifest reads like the disagreement-rate spreadsheet 7.1.5 teaches — one document to scan for "here's the labeled intent, here's where the ruler agreed or didn't." A's file-pair pattern doubles the file count and forces context-switching between paired files to read the intent. B contaminates the AgentOutput shape with grading metadata, which breaks the boundary between system output and grading meta-data (the same boundary chunk-2 design decisions Q4 holds with `output_id` and `scenario_id` as envelope fields and DiagnosisOutput as the pure contract). C keeps the mutation files as clean AgentOutputs and centralizes the labeling.

**What would change this decision:** Mutation count growing past ~50, where a single manifest file becomes unwieldy for scanning. Would shift to A's paired-file structure or to a CSV manifest at that scale. Not the case at retrofit scope.

---

## Q7 — Artifact updates and side-effects

**Decision:** The runner is read-only against existing chunk-1 artifacts.

- **Reads only:** `scenario.json`, `eval/src/*.ts` (via imports), `agent-outputs/mutations/*.json`, the manifest.
- **Writes:** stdout only. The runner prints structured results and judge reasoning on disagreements.
- **Does NOT modify:** `eval/src/validate.ts`, `agent-outputs/good.json`, `agent-outputs/wrong.json`, `scenario.json`, or any existing section of `VALIDATION-NOTES.md`.
- **VALIDATION-NOTES §5 is added by Sid manually** after a successful run, summarizing what was tested and any dropped mutations. The runner does not regenerate `VALIDATION-NOTES.md` — chunk-1's `validate.ts` owns that file's regeneration boundary, and the retrofit explicitly does not touch that ownership.

**Reasoning:** Two consumers now run against the same ruler (chunk-1 `validate`, chunk-2 `grade-system-output`); this is the third. The chunk-1 validate.ts is the only writer to VALIDATION-NOTES because its NOTES_PRESERVE_BOUNDARY logic owns the file. Adding a second writer creates a coordination problem (which run wins when both produce facts for the same file?) without any benefit — the retrofit's results land in a new section (§5) that doesn't intersect with the existing facts. Manual authoring of §5 is the right boundary.

**What would change this decision:** The retrofit becoming a recurring CI check rather than a one-time validation, at which point an automated §5 regenerator would justify the coordination cost.

---

## Discipline carry-over

These remain non-negotiable through the retrofit:

- **Facts owned by code, judgment owned by author.** The expected-grades manifest is the author's intent labels; the runner emits ruler grades; disagreements are surfaced as facts; the call on whether each disagreement is a ruler bug, a mutation drop, or a re-labeling is Sid's.
- **Real-time provenance.** This file is the provenance for the retrofit's design questions. Any build-phase decision surfaced during implementation goes in the same format, before moving past the decision.
- **Named course deviations.** Q1's adaptation of the multi-labeler framing to single-labeler-with-ruler reality is named explicitly. Q5's skip of back-translation is named explicitly. Q2's stricter-than-course done-criterion is named explicitly.
- **Sibling-runner pattern preserves the fenced grader.** Same discipline as chunk-2 Q17.

---

## Q8 — First-run finding: m04's text contradicted its own intent; replaced rather than dropped

**Surfaced by:** the first run of `validate-mutations.ts` after the design grill-me locked. Result: 1 disagreement out of 40 cells (2.5%) — m04's c2 graded FAIL by the ruler against PASS by intent. m10 (the pre-flagged disagreement candidate) agreed cleanly; the disagreement came from an unflagged axis.

**Investigation:** the original m04 text named both groups correctively in sentence 1 ("You checked data-team... Maya isn't actually a direct member of data-team. She's in data-team-ml") but then blamed a propagation timing delay in sentences 2–3. Timing-delay framing specifically undermines the operator correction: a sync-lag explanation implies the operator's membership check was *right* and access will self-heal — which contradicts the just-stated correction "she's in the wrong group." The judge correctly read the muddied correction as failing the "clearly and specifically" bar (`judges.ts` JUDGE_SYSTEM_PROMPT) and graded c2 FAIL.

**Diagnosis:** not a ruler bug, not a genuinely ambiguous text. **A mutation-design flaw.** Axis 4 (c2 passes, c1 fails) requires a wrong mechanism that is structurally *compatible* with the operator correction — sits on top of it, not against it. Timing/sync framing fails that requirement by construction. The original m04 was internally self-contradictory; the judge's grade was the right reading of the text.

**Options considered:**

- **A. Drop m04 under Q2's ≤1-mutation budget.** Most disciplined read of the locked done-criterion. Axis 4 goes untested.
- **B. Re-label m04's c2 to false (concede the judge).** Keeps the file. But m04 becomes grade-identical to m05, losing axis 4 entirely.
- **C. Replace m04 with a redesigned text that hits the c2-pass + c1-fail combination cleanly.** Same axis, same expected grades, different wrong mechanism — one that doesn't contradict the operator correction.

**Decision:** C — replace.

**Reasoning:** A and B both kill axis-4 coverage. The retrofit's purpose is validating the grader across all seven axes plus the edge case; losing one axis to a mutation-design flaw defeats that purpose. The ≤1-drop budget in Q2 exists for *genuinely ambiguous* mutations (e.g., the m10-class case), not for poorly constructed ones. Replace is not the "tweak the text to paper over a disagreement" anti-pattern flagged in the original Claude Code prompt — the anti-pattern would be silently editing m04 to make the judge agree with a label that's still wrong by design. Here, the label was correct *as an intent statement*; the text failed to realize the intent. Fixing the text to actually achieve the intent (and logging the swap, with the original flaw named) is the disciplined path.

**The replacement:** new m04 blames a "pending approval workflow" instead of timing. The correction "Maya is actually a direct member of data-team-ml — not data-team" stands as a standalone factual fix; the false approval-workflow mechanism layers on top without undoing it. Same expected grades: {verdict: true, root_cause: true, criterion_1: false, criterion_2: true}.

**Provenance carried forward:** VALIDATION-NOTES §5 records both the original m04 finding and the replacement, including the verbatim judge reasoning from the first run. The original m04 text is not retained in the manifest — the manifest is the current spec, and the §5 log is where the supplanted version is preserved for audit.

**Named anti-pattern this is not:** "tweak the mutation text to make the judge agree." The test for that anti-pattern is *what would have changed if the ruler's grade had matched the original intent?* If the answer is "nothing," then a text-only patch would have been a paper-over. Here, even if the judge had graded original m04's c2 as PASS, the text would still have been internally contradictory and a poor representative of axis 4 — the replacement was warranted regardless of the grade. The grade just surfaced the problem first.

**What would change this decision:** A second consecutive run where the redesigned m04 disagrees with intent — that would mean the axis itself is unstable, not the text. At that point the right call is A (drop axis 4 and name it in §5 as a coverage gap), not another replacement attempt.

**Updated discipline carry-over:** When a first run surfaces a mutation-design flaw distinct from ruler-bug-vs-mutation-ambiguity, the third path (replace) is in scope, but it requires this Q8-style entry — the original flaw named, the structural reason logged, the new mutation's design-fitness argued, and the swap recorded in VALIDATION-NOTES §5 with the original judge reasoning preserved. Otherwise the path becomes indistinguishable from the paper-over anti-pattern.
