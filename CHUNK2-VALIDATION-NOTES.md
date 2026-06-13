# Chunk 2 — Validation Notes

Created fresh by the SID-43 retrofit. Chunk 2's earlier work (the Seed-1
end-to-end demo on 2026-06-12) was recorded inline in
`CHUNK2-DESIGN-DECISIONS.md` (Q13's measured 0.21 threshold derivation, Q14's
self-consistency 3/3 result) rather than in a separate validation-notes file.
Those facts are not backfilled here; they live where they were logged at the
time. §1 onward is fresh for the SID-43 retrofit and forward.

> §1 is filled in by the SID-43 retrofit run. The script (`eval/src/validate-threshold.ts`) prints a paste-ready block on a successful run; copy it below to replace the placeholder. §2 is hand-authored — preserved across re-runs.

## 1. Retrofit (SID-43) — chunk-2 threshold calibration via seed-and-mutate

```
─ SID-43 — chunk-2 threshold calibration retrofit ─────────────────────────
Anchor symptom score (measured 2026-06-12): 0.3875
Threshold (CHUNK2-DESIGN-DECISIONS Q13):    0.21
Mutations to measure:                       10

Embedding each mutation against runbook corpus (voyage-4-lite, lazy-cached)...

─ Per-mutation scores ─────────────────────────────────────────────────────
[m01-casual-typo.json                ] score=0.4038  ✓ clears
    axis: 1 — pure symptom, casual + minor typos (Slack/chat style)
[m02-formal.json                     ] score=0.4288  ✓ clears
    axis: 2 — pure symptom, formal (ticket-system style)
[m03-anonymized.json                 ] score=0.4205  ✓ clears
    axis: 3 — anonymized (no specific user name)
[m04-terse-fragment.json             ] score=0.4688  ✓ clears
    axis: 4 — terse fragment (machine-or-stub-generated)
[m05-partial-mechanism.json          ] score=0.5012  ✓ clears
    axis: 5 — partial-mechanism language ('permissions')
[m06-verbose-context.json            ] score=0.5003  ✓ clears
    axis: 6 — verbose, with reasoning + context
[m07-third-person-ticket.json        ] score=0.4524  ✓ clears
    axis: 7 — third-person reporting (escalated from another operator)
[m08-blocked-framing.json            ] score=0.4312  ✓ clears
    axis: 8 — different verb framing ('blocked' instead of 'can't open')
[m09-first-person.json               ] score=0.3735  ✓ clears
    axis: 9 — first-person (end-user, not operator)
[m10-heavy-paraphrase.json           ] score=0.4489  ✓ clears
    axis: 10 — heavy paraphrase, low surface overlap

─ Summary ─────────────────────────────────────────────────────────────────
Anchor (calibration) score:          0.3875
Threshold:                           0.21
Mutations measured:                  10
Above threshold (sufficiency=pass):  10 / 10
Below threshold (false-escalate):    0 / 10
False-escalate rate at calibration:  0.0%

Score distribution across mutations:
  min:     0.3735
  median:  0.4489
  mean:    0.4429
  max:     0.5012

Structural fix: HyDE query transformation (course ref Deepak 8.2.6) lands in chunk 7.
Re-running this same mutation set after chunk-7 HyDE gives a direct before/after.
```

**Status:** RETROFIT COMPLETE (measurement-only per CHUNK2-RETROFIT-DESIGN-DECISIONS Q1). Result interpretation in §2.

## 2. What this measurement means going forward

**Measured outcome.** 0 of 10 paraphrases scored below the 0.21 threshold. The false-escalate rate at the current calibration is 0% on this axis set. The lowest mutation (m09, first-person end-user framing) landed at 0.3735 — still 0.16 above the threshold. The Q3 alarm (>50% false-escalate) was nowhere near tripped.

**Chunk-3 readiness call (per CHUNK2-RETROFIT-DESIGN-DECISIONS Q3): proceed.** The chunk-2 sufficiency signal is robust enough on these axes to safely build chunk 3 on top of. No threshold recalibration. No pulling HyDE forward from chunk 7.

**Three caveats that bound how strongly to read the 0% result.** The measurement is honest within its scope, but its scope is narrower than "the threshold is robust." Without these caveats logged, a future reader (or future-Sid) could over-update on the 0% number.

- **Caveat 1 — mutation vocabulary bias.** Several mutations (m05 particularly, also m06, m07) use vocabulary that sits closer to the runbook page's mechanism language than the anchor itself does — words like "permissions," "access," "membership," "group" appear more densely in the mutations than in `scenario.json`'s symptom. This makes those mutations *easier* embedding-similarity targets than the anchor was. The anchor sits near the bottom of the distribution (9 of 10 mutations score above it) partly because the mutation set drifted toward runbook-aligned phrasing during generation. The result is still meaningful — these mutations are realistic ways operators write — but a real-world ticket that happens to use less runbook-aligned vocabulary than the anchor (more "can't open," less "permissions") might score closer to or below the threshold. The 0% is the rate on *this* axis set, not a guarantee against all realistic paraphrasing.

- **Caveat 2 — one-sided threshold validation.** A similarity threshold has two failure modes: false-escalate (an in-domain query scores below the threshold and gets escalated; this is what was measured, at 0%) and false-clear (an off-domain query scores above the threshold and gets a real diagnosis; not measured here). The original Q13 calibration showed the off-domain "what's the weather" case scores 0.0236, well below 0.21 — so the off-domain side is anchored on one data point, same as the in-domain side. A full threshold validation would mutate the off-domain side (paraphrases of "weather"-class queries, plus borderline off-domain queries that *almost* fit chunk-2's diagnostic shape) and measure how many sneak above the threshold. This retrofit deliberately scoped to the false-escalate direction because Q13 named that as the worry; the false-clear direction remains armed but unvalidated. A chunk-3+ retrofit could close that side.

- **Caveat 3 — generation method and reviewer identity.** Per CHUNK2-RETROFIT-DESIGN-DECISIONS Q2 and the carry-over from SID-42 Q1, generation was Claude-in-one-pass + Sid-prunes. Same author-as-labeler structure as SID-42, with the same single-labeler limit named there. Different mutation phrasing chosen by a different operator (e.g., one who'd write less like the runbook by default) could produce a different distribution. The discipline carries from SID-42: this is an honest measurement, not a falsifiable claim about every possible operator's phrasing.

**Net interpretation.** The 0.21 threshold is more robust to surface variation than Q13 was concerned it would be — but the measurement is robust enough to ship chunk 3 on, not robust enough to declare the threshold validated against all realistic operator phrasing. Chunk-7 HyDE remains the right structural fix: it addresses the symptom↔mechanism vocabulary gap as a class rather than patching one number, AND it would naturally extend to closing the off-domain validation gap (caveat 2) since HyDE-transformed off-domain queries should still score low against the runbook.

**Chunk-7 HyDE before/after.** The same ten mutations under `agent-outputs/symptom-mutations/` remain the chunk-7 before/after dataset per Q7. The before number is 0% false-escalate, median 0.4489, mean 0.4429. HyDE's expected effect is to lift the in-domain band toward the ~0.70 mechanism-query baseline (CHUNK2-DESIGN-DECISIONS Q13 measured this), which would widen the in-domain-vs-off-domain gap and let the threshold be raised safely. The improvement we'll measure isn't "reduce false-escalate below 0%" (it's already 0%); it's "increase headroom from the threshold so future operator-phrasing drift doesn't erode the margin."

## 3. What would invalidate this retrofit going forward

- **Embedding model swap.** `voyage-4-lite` is the calibration anchor. A swap to `voyage-4`, `voyage-4-large`, or a future tier invalidates both the anchor's 0.3875 score and every mutation's score. Re-run.
- **Runbook page edit.** The covering page at `reference-library/nested-group-inheritance.md` is one half of the cosine comparison. Any edit invalidates every score. Re-run.
- **Anchor symptom edit.** The 0.21 threshold's derivation depends on `scenario.json`'s symptom text (the 0.3875 in-domain measurement). Edit it and the threshold itself needs re-derivation, not just a re-run.
- **Chunk-7 HyDE landing.** Re-derives the in-domain band against transformed queries; the threshold itself shifts. Same mutation set; new baseline. Per Q7.
- **Mutation set additions.** New axes get appended (Q2 forward link). The base ten remain; the added axes only extend coverage.
- **Cosine similarity replaced.** If the gate logic moves off cosine to a different scoring function (e.g., normalized inner product with a learned re-ranker), the threshold's units change and the calibration is gone. Full re-derivation needed.
- **Measurement is NFR-unmeasured.** Per the SID-42 retrofit close, NFR (latency, cost, error rate per run) was not measured for that retrofit; the same gap applies here. The runner is a one-shot validation, not a CI check; no NFR baseline exists. If this changes (e.g., runner promoted to CI), establish an NFR baseline first.
- **Runner env-loading: `.env` vs `.env.local` mismatch.** The runner's `dotenv.config()` (line 26 of `eval/src/validate-threshold.ts`) loads `.env` by default. The project's `VOYAGE_API_KEY` lives in `.env.local` (the chunk-2 convention). A bare `npx tsx eval/src/validate-threshold.ts` invocation exits with "VOYAGE_API_KEY is not set" unless the shell pre-sources `.env.local` (`set -a; . ./.env.local; set +a`). The first SID-43 run worked around this by sourcing; scores are unaffected by how the key reaches `process.env`. A chunk-7 re-run will hit the same wall. Two fixes: (a) patch the runner to `dotenv.config({ path: ".env.local" })`, or (b) document the source-then-invoke workflow in the chunk-7 retrofit doc. Logged as a real bug, not a measurement issue.
