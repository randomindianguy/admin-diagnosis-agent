# Chunk 2 Retrofit — Design Decisions (SID-43, threshold calibration via seed-and-mutate)

Real-time provenance for the chunk-2 retrofit. Same format as
`RETROFIT-DESIGN-DECISIONS.md` (chunk-1 retrofit): one entry per design
question, Q1–Q7 surfaced and locked in a design grill-me before any code,
written when the decision was made.

The retrofit addresses the chunk-2 limitation explicitly flagged in
`CHUNK2-DESIGN-DECISIONS.md` Q13: **the sufficiency threshold (0.21) is
calibrated to one specific symptom phrasing** — the exact string in
`scenario.json`. Free-text input variants of Seed 1 (paraphrases) may score
below 0.21 and escalate, because raw symptoms sit low against the
mechanism-language runbook. This retrofit measures *how badly* — producing
the false-escalate-rate baseline against which chunk-7's HyDE fix will be
measured.

---

## Q1 — What's the retrofit's done-state? (Reframe)

**Options considered:**

- **A. Pass/fail bar (SID-42 shape).** Set a threshold (e.g., "≥80% of paraphrases must clear the calibration line"); the retrofit passes or fails.
- **B. Measurement-only.** Produce the score distribution and false-escalate rate at the current threshold; the retrofit succeeds by recording the number honestly.

**Decision:** B — measurement-only.

**Reasoning:** SID-42 was a fitness test for a *judgment instrument* (the LLM-as-judge) — pass/fail framing was natural because the grader's correctness is binary per dimension. SID-43 measures a *numeric instrument* (cosine similarity threshold) against a known-imperfect baseline. There is no "correct" outcome to grade against — the threshold is already documented (Q13) as a placeholder anchored to one symptom string, with the structural fix queued for chunk 7. Imposing a pass/fail bar here would either (a) force a recalibration patch on a wrong foundation (the "virtue of laziness" violation — patches on a wrong foundation, deferred decisions), or (b) generate a false sense that the chunk-2 sufficiency signal is "validated" when it is in fact a known-fragile placeholder. B preserves the honesty: chunk-2 ships with a measured gap, chunk-7 closes it, the same mutation set produces a direct before/after.

**What would change this decision:** A finding that the gap is catastrophic enough to invalidate chunk-3's plan to build on the chunk-2 sufficiency signal (see Q3 alarm threshold below). At that point B's measurement triggers an A-shape escalation, but not in this retrofit's scope.

---

## Q2 — Mutation axes (how do paraphrases vary?)

**Decision:** Ten paraphrases across ten axes, all anchored on the same underlying problem (Maya in `data-team-ml` can't open `Q3 Revenue Models`, grant attached to `data-team`). The axes deliberately span surface variation without changing the semantic problem — every mutation is in-domain, and every one *should* clear the threshold if the threshold were vocabulary-invariant.

| # | Axis | Tested by |
|---|---|---|
| 1 | Casual + typos (Slack/chat) | m01 |
| 2 | Formal (ticket-system) | m02 |
| 3 | Anonymized (no user name) | m03 |
| 4 | Terse fragment | m04 |
| 5 | Partial-mechanism language ('permissions') | m05 |
| 6 | Verbose with reasoning + context | m06 |
| 7 | Third-person ticket (escalated) | m07 |
| 8 | Different verb framing ('blocked') | m08 |
| 9 | First-person (end-user filing own ticket) | m09 |
| 10 | Heavy paraphrase, low surface overlap | m10 |

**Reasoning:** Operators describe problems in widely varying surface forms. The chunk-2 anchor (`scenario.json`'s symptom text) is one specific form; cosine similarity over `voyage-4-lite` embeddings is sensitive to surface variation (this is the symptom↔mechanism vocabulary distance flagged in CHUNK2-DESIGN-DECISIONS Q13, course ref Deepak 8.2.6). Each axis tests one realistic source of surface variation at full strength while preserving the semantic anchor. m10 is the deliberate worst-case — semantically identical, lexically distant from both the anchor AND the runbook. The expectation, named upfront: m10 likely scores lowest of the ten and may sit well below 0.21.

**Generation method (locked by precedent):** Claude generates the ten paraphrases in one pass given the anchor + the runbook page; Sid reviews and prunes. Same as SID-42 and chunk-3 Q4.

**What would change this decision:** A real chunk-2+ ticket exhibiting a surface variation outside these axes (e.g., a multi-symptom ticket, a non-English query, a ticket that mixes mechanism and symptom language). Additive — would add the missing axis as an eleventh mutation and re-run, not invalidate the existing ten.

---

## Q3 — Done-criterion (no hard bar; named alarm)

**Decision:** No hard pass/fail bar (per Q1). The retrofit produces the false-escalate rate at the current threshold and ships that number as the chunk-2 sufficiency baseline. Recalibration is **explicitly deferred** to chunk 7's HyDE work.

**Named alarm (not a done-criterion — a "stop and discuss" trigger):** if the false-escalate rate exceeds 50% (>5 of 10 paraphrases below the threshold), the chunk-2 sufficiency signal is too fragile to safely build chunk 3 on top of. At that point Sid pauses chunk 3 to either (a) raise the threshold based on the measured distribution, or (b) pull HyDE forward from chunk 7. **Anything below 50% is the expected outcome** — we knew the threshold was anchored to one string; some false-escalate rate is the price of waiting for the structural fix.

**Reasoning:** A pass/fail bar would force premature optimization (Q1 logic). But not having any escalation criterion would let an alarming finding (e.g., 80% false-escalate) get logged and ignored. The 50% line is a deliberate "this would break chunk 3" trigger, not a quality target.

**What would change this decision:** A measured rate above 50% triggers a new design conversation (raise threshold? pull HyDE forward?); below 50% locks chunk-3 as the next step.

---

## Q4 — What gets measured, how

**Decision:** For each mutation, the runner calls `retrieveRunbook(symptom)` from the **unchanged** chunk-2 `lib/retrieval.ts`. Top score from the returned ranked evidence is compared against `SUFFICIENCY_THRESHOLD` (0.21) from the **unchanged** `lib/gate-signals.ts`. Report: score, pass/fail verdict per mutation, plus summary distribution (min/median/mean/max) and false-escalate rate.

**Reasoning:** Reuse the exact retrieval + sufficiency logic the chunk-2 system uses — anything else would measure a parallel implementation, not the real signal. The lazy + module-scope memoized embedding cache (CHUNK2-DESIGN-DECISIONS Q10) means the runbook embeds once across all ten mutations.

**Implementation wrinkle named:** `lib/retrieval.ts` builds `REFERENCE_LIBRARY_DIR` and `SCENARIO_PATH` from `process.cwd()` at module-load time. The runner must `process.chdir(projectRoot)` *before* importing `lib/retrieval`. Because ESM static imports are hoisted, this is implemented as a static cwd-fix followed by dynamic imports of the chunk-2 modules.

**What would change this decision:** A chunk-7 change moving the path constants away from `process.cwd()` (e.g., to a config-file-based path) would simplify the runner — drop the chdir + dynamic-import pattern, use static imports. Trivial change when the time comes.

---

## Q5 — Implementation location

**Decision:** Sibling runner at `eval/src/validate-threshold.ts`. Inherited from CHUNK2-DESIGN-DECISIONS Q17 (same pattern SID-42 used).

**Reasoning:** Same constraints, same shape — measuring something against the unchanged chunk-2 code without modifying any fenced file. The runner does not touch `lib/retrieval.ts`, `lib/gate-signals.ts`, `scenario.json`, `reference-library/*`, or chunk-1's eval files. Writes nothing; reads only.

**What would change this decision:** Same as SID-42 — the sibling-runner pattern scales to several seeds before promoting to a first-class CLI arg becomes justified.

---

## Q6 — Storage location for mutations + manifest

**Decision:**

- `agent-outputs/symptom-mutations/m01..m10.json` — one symptom per file, JSON envelope `{symptom_id, text}` (parallel to SID-42's AgentOutput envelope shape).
- `agent-outputs/symptom-mutations/manifest.json` — the manifest with axis + rationale per mutation, plus the anchor score, threshold, and threshold derivation as header metadata.

**Reasoning:** Mirrors SID-42's manifest pattern. Single document to scan for "what was tested and why." No expected-grade field (per Q1 measurement-only); the manifest only documents what each mutation tests and what axis it exercises. Anchor metadata at the top means the runner doesn't have to re-derive the calibration history at runtime.

**What would change this decision:** Same as SID-42 — manifest unwieldy past ~50 mutations would shift to CSV or paired-file. Not the case at retrofit scope.

---

## Q7 — Forward link to chunk-7 HyDE

**Decision:** The same ten mutations are the chunk-7 HyDE before/after dataset. No new mutation set generated for that work — chunk 7 re-runs `validate-threshold.ts` (with HyDE wired into retrieval) against the same files, producing a direct apples-to-apples improvement measurement.

**Reasoning:** Generating two mutation sets risks them diverging in subtle ways (different axes, different anchors, different drift). One set, two runs, same instrument is the only honest before/after.

**What would change this decision:** Discovery during chunk-7 build that HyDE needs additional axes to stress-test it (e.g., axes specifically designed to *hurt* HyDE — symptoms where HyDE's hypothetical-passage generation would go wrong). Additive — would extend the ten with HyDE-specific axes, not replace them.

---

## Discipline carry-over from SID-42 and chunk 2

- **Facts owned by code, judgment owned by author.** The runner produces the score table mechanically; the interpretation (false-escalate rate, what it means for chunk 3) is in CHUNK2-VALIDATION-NOTES.
- **Real-time provenance.** This file's Q1–Q7 are the decisions from the design grill-me, locked before code. Any build-phase decision surfaced during implementation gets logged here at the moment it's made.
- **Sibling-runner pattern preserves fenced code.** Same as SID-42 and CHUNK2-DESIGN-DECISIONS Q17.
- **Measurement, not patching.** The 0.21 threshold is a known placeholder; the right fix is structural (chunk-7 HyDE), not a recalibration patch on a wrong foundation. Q1's measurement framing enforces this discipline.
