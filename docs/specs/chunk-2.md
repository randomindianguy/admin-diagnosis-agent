# Chunk 2 — Diagnosis System + V4 UI (Seed 1 end-to-end)

## What this chunk produces

A working diagnosis system + V4 UI that:

1. Accepts free-text input from the user (operator types symptom)
2. Runs Seed 1 end-to-end (retrieval → diagnosis → gate → structured output)
3. Renders the result in the V4 two-pane UI with Glean-derived styling
4. Produces output that the chunk-1 grader validates correctly for the right reasons

Plus the artifact half: `CHUNK2-DESIGN-DECISIONS.md` with Q1–Q6 already locked, growing with any new decisions made during build (real-time provenance, same discipline as chunk 1).

**Done-criterion:**

- ✅ App runs locally via `npm run dev`
- ✅ User types Seed 1's symptom (or clicks the chip), gets a V4 response showing `resolve` + `root_cause: nested_subgroup_inheritance_gap` + a `diagnosis_text` that names both groups (`data-team` and `data-team-ml`) and corrects the operator
- ✅ User types something off-domain (e.g., "what's the weather"), system handles gracefully — for chunk 2 this means evidence-sufficiency fails and the system escalates with low confidence; refuse-out-of-scope is chunk 3's mechanism
- ✅ The system's output JSON for Seed 1, exported to a file, passes the chunk-1 grader's good-output validation
- ✅ `CHUNK2-DESIGN-DECISIONS.md` reflects Q1–Q6 (from grill-me) plus any new decisions made during build, in real-time provenance format

If the grader fails the system's output: fix the system, not the grader.

## Scope discipline

**This chunk delivers:**

- Next.js app (app router) with retrieval + diagnosis + gate + V4 UI
- One scenario working end-to-end (Seed 1)
- Two gate signals only (sufficiency + consistency)
- The chip surface (clickable example queries)
- The previous-verdict slim row (per UI spec Q2c)
- The "how this decides" expandable (per UI spec Q2d)
- Glean-derived tokens applied across the UI
- Real-time design decisions log

**It does NOT deliver:**

- More scenarios (Seeds 2–5 are chunks 3–6 per the revised order)
- The third gate signal (chunk 5)
- The `refuse_out_of_scope` verdict variant or refusal component logic (chunk 3 — though the refusal component *shell* is structurally accounted for in the UI)
- Deployment to Vercel (chunk 7)
- Mobile responsive design beyond what falls out for free (chunk 7)
- Mutation engine, marketing copy, animation polish (chunk 7)

If tempted to "just also add..." — stop and ask Sid first.

## Stack

- Next.js (latest, app router)
- TypeScript with `strict: true`
- Anthropic SDK (same family as chunk 1's `@anthropic-ai/sdk@0.69.x`)
- TanStack Query (`@tanstack/react-query`) for server state
- Tailwind CSS, configured to read from `tokens.ts`
- `dotenv` (Next.js convention — `.env.local`)

## What's provided (read-only spec inputs)

```
Project/
  README.md                            ← chunk 1 spec, reference
  scenario.json                        ← Seed 1 scenario (retrieval setup reads this)
  reference-library/
    nested-group-inheritance.md        ← the one runbook page (the corpus, for now)
  DESIGN-DECISIONS.md                  ← chunk 1's Q1–Q8 (reference for disciplines carried forward)
  VALIDATION-NOTES.md                  ← chunk 1's validation artifact
  CHUNK2-DESIGN-DECISIONS.md           ← Q1–Q6 already drafted (REQUIRED READ FIRST)
  ui-spec.md                           ← UI spec from the UI grill-me
  UI-DESIGN-DECISIONS.md               ← UI grill-me's Q1–Q3 (REQUIRED READ)
  tokens.ts                            ← Glean-derived design tokens, v1
  agent-outputs/
    good.json                          ← reference for the output shape your system must produce
    wrong.json                         ← chunk-1's reference confidently-wrong (not consumed here)
  eval/                                ← chunk-1's grader (do not modify; runs against your output)
```

## The six locked design decisions (do not re-litigate)

These are settled in `CHUNK2-DESIGN-DECISIONS.md`. Read the entries before building anything.

- **Q1** — Two-channel retrieval: embedding search over runbook corpus + identity-based fetch from `status_picture` by entity reference.
- **Q2** — Anthropic SDK tool-use for structured diagnosis output. Schema-enforced, no JSON-via-prompt fragility.
- **Q3** — Two gate signals only (evidence sufficiency, answer consistency). Third signal deferred to chunk 5 alongside Seed 3.
- **Q4** — Discriminated-union output schema (resolve | escalate). Chunk-2-applicable fields only. Additively widened by chunks 3, 5, 6.
- **Q5** — Single Next.js app, app router style. API routes hold backend logic. Anthropic key lives server-side in `.env.local`.
- **Q6** — TanStack Query for server state, `useState` for local UI state.

## The output schema (Q4 made concrete)

The system emits this discriminated union via Anthropic tool-use:

```typescript
// shared schema — system emits, UI renders, grader validates
type RetrievedEvidence = {
  source: string;   // e.g., "nested-group-inheritance.md"
  snippet: string;  // the relevant chunk text
};

type GateSignal = "pass" | "fail";

type DiagnosisOutput =
  | {
      verdict: "resolve";
      root_cause: CanonicalRootCause;
      diagnosis_text: string;
      retrieved_evidence: RetrievedEvidence[];
      gate_signals: {
        sufficiency: GateSignal;
        consistency: GateSignal;
      };
    }
  | {
      verdict: "escalate";
      owner: string;
      diagnosis_text: string;
      retrieved_evidence: RetrievedEvidence[];
      gate_signals: {
        sufficiency: GateSignal;
        consistency: GateSignal;
      };
    };
```

The chunk-1 grader currently reads `verdict`, `root_cause`, `owner`, `diagnosis_text` directly. The UI consumes the full object.

## Canonical root_cause label list (chunk-2 starting set)

For chunk 2, the canonical labels are:

```typescript
type CanonicalRootCause =
  | "nested_subgroup_inheritance_gap"
  | "propagation_lag"
  | "explicit_deny_override"
  | "group_membership_revoked";
```

Authoring rule, per Phase 1 §3: **if no canonical label matches the diagnosis, the system MUST escalate. It must never invent a new label.** This is enforced via the tool-use schema (the `root_cause` field is a string union, not an open string).

When chunks 3–6 add new seeds, the canonical list grows. Each new label added must map to one or more scenarios' expected `root_cause`.

## File structure (proposed — bring deviations to Sid)

```
Project/
  app/
    layout.tsx                         ← root layout, fonts, providers
    page.tsx                           ← the main diagnosis page (V4 UI lives here)
    api/
      diagnose/
        route.ts                       ← POST /api/diagnose endpoint
  components/
    diagnosis-input.tsx                ← input box + chips + framing line
    diagnosis-output.tsx               ← V4 two-pane component (resolve + escalate)
    refusal-output.tsx                 ← single-pane shell (logic in chunk 3)
    previous-verdict-row.tsx           ← slim summary row
    how-this-decides.tsx               ← expandable, copy authored by Sid
  lib/
    retrieval.ts                       ← Q1's two channels
    diagnosis.ts                       ← Q2's tool-use call
    gate-signals.ts                    ← Q3's sufficiency + consistency
    schema.ts                          ← the discriminated union
    canonical-labels.ts                ← the root_cause label list
  hooks/
    use-diagnose.ts                    ← TanStack Query wrapper for /api/diagnose
  tailwind.config.ts                   ← reads tokens.ts
  next.config.ts
  package.json, tsconfig.json
  .env.local                           ← ANTHROPIC_API_KEY (gitignored)
  .env.local.example                   ← template
```

## What CC should bring to Sid as a build decision

The grill-me locked the six big decisions. Several smaller ones will surface during the build. Bring each one to Sid at the moment it becomes relevant:

1. **Embedding model choice.** Voyage AI, Anthropic, OpenAI, or local. Cost/recall/latency tradeoffs.
2. **Chunking strategy for the runbook page.** The single page is ~300 words. Chunk it, or embed whole? Whole probably wins at this size, but flag the decision.
3. **N (answer consistency sample count).** Q3 noted N=3 as a placeholder. Confirm or adjust.
4. **Evidence-sufficiency similarity threshold.** Q3 noted ≥0.5 as a placeholder. Same — confirm or measure.
5. **API route response style.** Blocking (return when ready) or streaming (send tokens as they arrive)? Blocking is simpler; streaming feels more "alive" but adds complexity. Chunk-2 default lean: blocking.
6. **Error UI surfaces.** What does the user see if the API call fails? If retrieval returns nothing? If the LLM fails to emit a valid tool call?
7. **Loading state design.** The diagnose call will take 3–8 seconds. Spinner, skeleton, progress indicator, or "thinking..." text?
8. **"How this decides" expandable content.** What does it actually say? Authored copy is judgment, not generated.
9. **Empty state design.** What's on screen before any query is submitted? The chips probably handle most of this.
10. **Framing line copy.** Per UI spec, "one line of persistent framing near the input." Sid authors this.

Bring each up at the moment it becomes relevant in the build. **One bounded question at a time.** Propose a default with reasoning. Get Sid's call. Write the entry in `CHUNK2-DESIGN-DECISIONS.md` (Q7, Q8, …) before moving on.

## Build order of operations

1. **Scaffold.** `npx create-next-app` with app router, TypeScript, Tailwind. Verify it boots.
2. **Dependencies.** Install Anthropic SDK + TanStack Query. Verify nothing else snuck in.
3. **Tokens integration.** Wire `tokens.ts` into `tailwind.config.ts` so utility classes use Glean colors/fonts/spacing.
4. **Schema.** Author `lib/schema.ts` (the discriminated union above) + `lib/canonical-labels.ts`.
5. **Retrieval.** Author `lib/retrieval.ts` per Q1 — two channels, one function exported per channel, one orchestrator.
6. **Diagnosis call.** Author `lib/diagnosis.ts` per Q2 — Anthropic tool-use, schema-enforced output.
7. **Gate signals.** Author `lib/gate-signals.ts` per Q3 — sufficiency + consistency only.
8. **API route.** Author `app/api/diagnose/route.ts` that wires retrieval → diagnose → gate signals → return.
9. **UI components.** Author the V4 two-pane component, the input, the chips, the previous-verdict row, the expandable.
10. **TanStack Query wiring.** Author `hooks/use-diagnose.ts`; wrap the app in `QueryClientProvider`.
11. **End-to-end test (manual).** Open localhost, run Seed 1 symptom, see V4 output.
12. **Grader validation.** Export system output to JSON. Run chunk-1 grader against it. Confirm PASS.
13. **Decisions log.** Confirm `CHUNK2-DESIGN-DECISIONS.md` reflects every decision made during the build.

Show Sid the file/dependency plan before scaffolding. Show diffs before running. Show progress in stages, not as one giant final result.

## Sid's working style (carry-over from chunk 1)

These are non-negotiable disciplines from the previous build session:

- **Plain language always.** No dev-flavored entity names without translation. When something feels heavy, suspect the words before the work.
- **One bounded question at a time.** Pose ONE question, give your recommended answer + reasoning, then STOP and wait. Do NOT spawn sub-questions inline — log them and walk them in sequence.
- **Cost / latency / accuracy** only when they distinguish options. Skip the section when they don't — don't ritualize it.
- **Output before form.** Structure things by what's produced, not by the steps to produce it.
- **Pressure-test gracefully.** He challenges; treat those as sharp. Be honest when something doesn't need changing rather than manufacturing a change.
- **Real-time provenance.** Decisions get logged in `CHUNK2-DESIGN-DECISIONS.md` at the moment they're made, in the format already used for Q1–Q6.
- **Disjointness.** Each chunk tests one mechanism. Don't bake chunk-3 or chunk-5 work into chunk 2.
- **Stop at saturation.** If Sid says "I'm losing track," consolidate to a written fragment and stop.

## Done-criterion validation walk-through

When the chunk feels done, run this sequence:

1. `npm run dev`. App boots without errors.
2. Open localhost. V4 UI renders. Glean-styled (Polysans-substitute font, midnight-blue text, blue accent, white surface).
3. Click the Seed 1 example chip — should populate the input with Seed 1's symptom.
4. Submit. The system responds with:
   - `verdict: "resolve"`
   - `root_cause: "nested_subgroup_inheritance_gap"`
   - `diagnosis_text` that names BOTH `data-team` (where operator checked) AND `data-team-ml` (where Maya sits), and corrects the operator's mistaken claim
   - Left pane shows retrieved evidence (the runbook page) and gate signals (sufficiency=pass, consistency=pass)
5. Export that exact output object to `agent-outputs/seed-1-system-output.json`.
6. Run the chunk-1 grader against it: `cd eval && npm run validate` (after swapping the good-output reference to the new file, or by running grading on the new file directly).
7. Expected grader output: `verdict=PASS root_cause=PASS criterion_1=PASS criterion_2=PASS → RULER PASSES ✓`.
8. If the grader fails: fix the system, not the grader. The grader is the ruler from chunk 1; it's the trustworthy party. System disagreement with the grader is system bug.
9. Type something off-domain ("what's the weather"). The system should escalate (evidence sufficiency fails because retrieval finds nothing similar) — graceful behavior even without chunk 3's refuse logic.
10. Confirm `CHUNK2-DESIGN-DECISIONS.md` has entries for every design decision made during the build (Q7 onward for any new ones).

Then the chunk is done.

## Forward links (do NOT build now)

Each subsequent chunk extends this work additively. Do not build for these in chunk 2.

- **Chunk 3 (Seed 5, refuse_out_of_scope):** widens the verdict union; populates the refusal component shell with logic and copy; introduces Seed 5 scenario authoring.
- **Chunk 4 (Seed 2, false-healthy):** adds connector-status as a retrieval channel; introduces Seed 2 scenario.
- **Chunk 5 (Seed 3, post-change false trail):** adds the third gate signal (`change_addressed`); adds change-log retrieval channel; introduces Seed 3 scenario. **This is the chunk that completes the gate's three-signal architecture per the Phase 2 lock.**
- **Chunk 6 (Seed 4, contested routing):** widens escalate schema with `routing: {state, owners, recommended}`; introduces Seed 4 scenario.
- **Chunk 7 (deployment + polish):** Vercel deploy, mobile responsive, animation, error UI polish, performance pass.

The chunk-2 schema, retrieval architecture, and API contract are designed to absorb these additively. If chunk 2's foundation requires restructuring during a later chunk, that's a chunk-2 design defect that should be caught and surfaced.
