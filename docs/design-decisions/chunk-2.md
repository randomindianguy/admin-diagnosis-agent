# Design Decisions — Chunk 2 (Diagnosis System + V4 UI, Seed 1 end-to-end)

Real-time provenance. One entry per design question, written when the
decision was made. Same format inherited from the chunk-1 design decisions:
Question / Options considered / Decision /
Reasoning / What would change this decision.

Q1–Q6 are the design grill-me locks. Q7 onward will land as build-phase
decisions surface during chunk-2 implementation.

---

## Q1 — Retrieval shape: what gets retrieved, and from what?

**Options considered:**

- **A. Embedding search over runbook corpus only.** Status picture not retrieved; diagnosis works from runbook content alone.
- **B. Two-channel retrieval.** Embedding search over runbooks (similarity-shaped) + structured fetch of status picture by entity reference (identity-shaped). Both feed the diagnosis prompt.
- **C. Unified embedding index.** Treat every status-picture fact as a retrievable document, embedded alongside runbook chunks. Top-k retrieval across the unified pool.

**Decision:** B — two-channel retrieval. Runbook retrieval uses cosine similarity over embedded chunks. Status fetch parses the symptom for entity references (user names, resource names) and looks them up directly in the JSON status picture. Both feed the diagnosis prompt.

**Reasoning:** Cost is flat across all three (embeddings are pennies; status fetches are free local JSON reads). Latency is comparable — B adds a milliseconds-scale lookup on top of A. Accuracy is the deciding axis. A under-retrieves: Seed 1's two-part diagnostic bar (identify mechanism + correct the operator's mistaken claim) requires both runbook knowledge AND current-state knowledge; A starves the diagnosis of the second half. C conflates two different kinds of retrieval — runbooks are *referential* (find the right mechanism page), status facts are *targeted* (find this specific user's memberships). Forcing both into one similarity space predictably ranks the wrong kind of fact in the top slot. B separates concerns: similarity-shaped lookup for what mechanism applies, identity-shaped lookup for what's actually true about this user/resource.

**What would change this decision:** If the corpus grew to thousands of users with name collisions or fuzzy-matching requirements, the identity-fetch side would need a real index instead of a JSON lookup. Not a factor at chunk-2 scale (one user, one resource in the status picture).

**Forward link:**

- Seed 2 (false-healthy, chunk 4) extends this with connector-status as a *third* retrieval channel, by type — not a unification with the other channels.
- Seed 3 (post-change false trail, chunk 5) adds change-log retrieval as a *fourth* channel, temporal-shaped.
- Seed 5 (out-of-scope, chunk 3) relies on runbook retrieval *failing meaningfully* on off-domain queries. B's separation keeps that signal clean — "the runbook channel came back with nothing above the similarity threshold" is unambiguous. C would have status-fact noise contaminating that signal.

---

## Q2 — Diagnosis prompt shape: how does the system get structured output from Claude?

**Options considered:**

- **A. Free-form prose diagnosis, second LLM call to extract structured fields.** Two API calls per diagnosis: one for prose, one for extraction.
- **B. JSON-shaped prompt.** Prompt instructs the model to emit a JSON object with named fields. One call, parsed as JSON.
- **C. Anthropic SDK tool-use.** Output schema defined as a tool the model must call. The API enforces structure; the SDK parses and type-checks before the output reaches application code.

**Decision:** C — tool-use with a defined schema. The schema becomes a shared contract referenced by the diagnosis call, the UI, and the chunk-1 grader.

**Reasoning:** Cost: A is 2× the API calls of B and C (extraction is a second step); B and C equivalent. Latency follows the same direction. Accuracy is the deciding axis. A introduces a second uncertain step — the extraction model can mis-classify the verdict, miss the root_cause label, hallucinate an owner field. B's JSON-via-prompt is fragile under edge cases: trailing prose, markdown code fences, malformed JSON, comments. Each failure mode needs defensive parsing — the same fragility class as chunk-1's Q3 strict-parse, but on richer output. C uses the API's schema-enforced output mechanism: the model is structurally constrained to emit a tool call matching the defined schema, the SDK parses and validates before application code sees it. Same principle as the rest of the system: refuse to silently handle malformed input; reject it at the boundary.

**What would change this decision:** A future model dropping tool-use support (extremely unlikely) or a need for dynamically generated schemas per scenario (not the case — the schema is fixed across all five seeds with one union-widening for Seed 5 in chunk 3). Not factors at chunk-2 scope.

**Forward link:** The schema is a TypeScript discriminated union starting at `verdict: 'resolve' | 'escalate'` for Seed 1. Widens additively to include `'refuse_out_of_scope'` when chunk 3 lands. One canonical definition, referenced by system, UI, and grader.

---

## Q3 — Gate signal implementation: which signals fire for chunk 2's Seed 1 build?

**Options considered:**

- **A. Build all three signals now.** Evidence sufficiency, answer consistency, and recent-change-accounted-for. Forward-compatible for Seeds 2–6 with no rework when those land.
- **B. Build only the two signals applicable to Seed 1's mechanism.** Sufficiency + consistency. Defer the third signal to chunk 5 alongside Seed 3.
- **C. Skip the gate entirely for chunk 2.** System always resolves confidently.

**Decision:** B — sufficiency + consistency only. Recent-change-accounted-for deferred to chunk 5.

**Reasoning:** Cost favors B — A builds the most complex signal (two-tier detection ladder per Phase 2's gate spec) for no chunk-2 benefit, since Seed 1's change log is empty by construction. Latency: answer consistency requires N samples per diagnosis (N=3 placeholder per Phase 4 tuning), already a real latency cost for a touchable demo; adding the third signal compounds it. Accuracy: A and B equivalent on Seed 1 — the third signal is moot when the change log is empty. C is not viable: it breaks the chunk-1 grader's contract. The grader's wrong-output sample picks `propagation_lag` (a canonical-but-wrong label), and the grader needs to validate that the gate actually catches confidently-wrong outputs — without a gate, the system would resolve confidently on anything, and the thesis (confident-wrong outputs get caught) isn't demonstrated. B is the disjointness principle applied to gate signals: build the mechanism the chunk's seed exercises, defer the rest to their chunks.

**MVPerf framing:** Build the minimum that catches the chunk-1 grader's wrong-output and demonstrates the thesis end-to-end. Prove it works. Then expand mechanism by mechanism.

**Authoring choices (placeholders for Phase 4 tuning, not grill-me questions):**

- N (answer consistency sample count): starts at N=3.
- Evidence sufficiency similarity threshold: starts at cosine ≥ 0.5.

**What would change this decision:** Discovery that Seed 1's wrong-output case requires the third signal to be caught. It doesn't — `propagation_lag` is a wrong-mechanism diagnosis, caught by criterion 1 (mechanism identification) and root_cause exact-match mismatch, both independent of the third signal.

**Forward link / chunk-5 contract:**

When Seed 3 (chunk 5) lands, the third signal (`recent_change_addressed`) **must** be added per Phase 2's locked gate spec. This includes both layers:

1. The retrieval layer (pull change-log into context so the diagnosis can reason about it).
2. The gate backstop — the two-tier ladder (cheap embedding check first, LLM-judge on the ambiguous middle band) for detecting "diagnosis-omits-the-change."

The Seed 3 scenario's `change_log` field will be non-empty by construction, which activates the signal's relevance. `VALIDATION-NOTES.md` §4 should record this deferral at chunk-2 close as a chunk-5 invalidation/extension condition.

---

## Q4 — Output schema: what fields does the system emit for chunk 2?

**Options considered:**

- **A. Match chunk-1's grader exactly.** Four fields only: verdict, root_cause, owner, diagnosis_text.
- **B. Grader-readable fields + UI-renderable fields for V4's reasoning pane.** Adds retrieved_evidence and gate_signals to the schema.
- **C. Full schema designed for all five seeds upfront.** Includes refuse_out_of_scope, contested routing, expected_signal metadata — all hypothetical for chunks 3–6.

**Decision:** B — discriminated union on `verdict: 'resolve' | 'escalate'`, with the chunk-2-applicable fields per variant.

Schema (chunk-2 scope):

- **Common to both verdicts:** `verdict`, `diagnosis_text`, `retrieved_evidence: [{source, snippet}]`, `gate_signals: {sufficiency: 'pass' | 'fail', consistency: 'pass' | 'fail'}`
- **If `resolve`:** `root_cause: <canonical label>`
- **If `escalate`:** `owner: string`

**Reasoning:** Cost and latency flat across all three (schema is a one-time TypeScript file, no runtime effect). Accuracy is the deciding axis. A starves the V4 UI — the left "reasoning" pane is the stage-1/2 trust mechanic, and without retrieved_evidence and gate_signals it has nothing to render. Forcing the UI to fabricate content there breaks the "facts owned by code, judgment owned by author" discipline from chunk 1. C over-designs for seeds that don't exist yet — Seed 5's `refuse_out_of_scope` variant and Seed 4's contested-routing shape will pressure-test against real authoring when those chunks land; pre-committing the union now risks refactoring it when reality intrudes. B is the disjointness principle applied to schema design: build for the seed being built, widen additively when other seeds land.

**MVPerf framing:** Schema for the mechanism this chunk tests. Refuse to widen for hypothetical future fields.

**What would change this decision:** Discovery during chunk-2 build that the UI needs additional fields to render V4 properly (e.g., a confidence score the user sees, a per-signal explanation). Additive — would extend B's schema, not invalidate the framing.

**Forward link / chunks 3 + 5 + 6 contracts:**

- **Chunk 3 (Seed 5):** widens the verdict union to include `'refuse_out_of_scope'`. The refuse variant has no root_cause, no owner — just a scope-perimeter explanation. This is the *first* non-additive change to the schema; all consumers (UI, grader, system) must handle the wider union.
- **Chunk 5 (Seed 3):** adds the third gate signal under `gate_signals`: `change_addressed: 'pass' | 'fail'`. Additive — chunk-2 consumers ignore the new field; chunk-5 consumers read it.
- **Chunk 6 (Seed 4):** adds contested-routing fields under escalate: `routing: {state: 'clear' | 'contested', owners: string[], recommended: string}`. The current `owner` field is a special case of this (a `clear` routing with one owner). Chunk 6 will need to decide whether to keep `owner` for backward compat or refactor uniformly. Not chunk-2's call.

**Separation worth holding:**

- **System output** = the schema above. What the LLM emits via tool-use (Q2). Locked here.
- **Grader output** = what gets logged in `VALIDATION-NOTES.md`. Includes the system's output PLUS judge-generated metadata (Q7's explainability column from chunk 1, per-field pass/fail). Locked in chunk 1.

Two schemas, two layers. Chunk 2 only defines the system's output shape.

**Authoring note (added during step 4):** `DiagnosisOutput` is the pure system-output contract — what the LLM emits via tool-use. The chunk-1 grader's `AgentOutput` type additionally reads `output_id` and `scenario_id`; those are envelope fields added by the export step at chunk-2 close (step 12), not part of the system's emission. Keeping the schema as the pure contract preserves the boundary between system and consumer.

---

## Q5 — Backend ↔ frontend contract: how does the UI talk to the system?

**Options considered:**

- **A. Single Next.js app.** UI as pages/components in `app/`, system logic in API routes under `app/api/*/route.ts`. One repo, one deploy.
- **B. Separate frontend (React/Vite) + backend (Node/Express).** Two services, two deploys.
- **C. Frontend-only.** Browser calls Anthropic API directly. No backend server.

**Decision:** A — Next.js with the app router. UI under `app/`, API routes under `app/api/*/route.ts`. The frontend calls `/api/diagnose` with the symptom; the API route runs retrieval, calls Claude via tool-use (Q2), returns the structured output (Q4). Anthropic API key lives in server-side env vars only.

**Reasoning:** C is a non-starter — putting the API key in browser code exposes it to anyone with DevTools, an embarrassing error for a capstone artifact a hiring manager will inspect. B over-engineers for one repo, one developer, one deploy target — the coordination tax (CORS, two deploys, contract drift between services) buys nothing when team-of-one ownership doesn't demand separation. A is the standard pattern for exactly this shape: deploys to Vercel natively (matching chunk 7's deployment plan), keeps the API key server-side, allows same-origin requests with no CORS overhead. Cost: A is cheapest in deployment overhead. Latency: A is fastest — same-origin requests, no extra network hop.

**App router specifically (vs. pages router):** Cleaner file-as-route mental model; better support for streaming responses if diagnosis output ever needs to stream to the UI in a future chunk; the direction Next.js development is investing in.

**What would change this decision:** A separate frontend would make sense if the diagnosis system became multi-tenant or needed to be embedded in another product (e.g., a Glean partnership where the system is consumed by Glean's own admin console). Not relevant for a standalone capstone demo.

**Forward link:**

- Chunk 7 deploys this on Vercel with zero config. The repo structure decided here is the structure that ships.
- The `/api/diagnose` route is the canonical contract surface. Its request shape (`{ symptom: string }`) and response shape (the Q4 schema) is what the UI codes against. Any change to that contract is a chunk-2 schema change, not a chunk-2 implementation detail.

---

## Q6 — UI state management: how is state handled in the V4 UI?

**Options considered:**

- **A. React's built-in `useState` for everything.** Each piece of state (input text, outcome, in-flight flag, previous verdict) is a `useState` call. Simple, no dependencies, idiomatic for small apps.
- **B. A state management library** (Zustand, Jotai, Redux, etc.). External store. Components subscribe to slices.
- **C. TanStack Query for server state + `useState` for local UI state.** TanStack handles the `/api/diagnose` lifecycle; `useState` handles input text and purely-UI state.

**Decision:** C. TanStack Query handles the request lifecycle for `/api/diagnose` (loading, error, success, stale-while-revalidate for the previous-verdict row per UI spec Q2c, cancellation when a new query supersedes an old one). `useState` handles input text, chip-clicked state, the open/closed state of the "how this decides" expandable.

**Reasoning:** Cost is flat — TanStack Query is a small dependency. Latency is flat — state libraries don't affect runtime materially. Accuracy is the deciding axis. A under-handles the request lifecycle: the diagnose call takes 3–8 seconds, can fail, can be retried, can be cancelled if the user submits again. Hand-rolling all of this with `useState` and `useEffect` means writing loading/error/retry/cancellation logic from scratch — every bug in that logic is one that breaks the "feels like a real product" goal. B is the wrong tool for this size: Zustand/Jotai/Redux make sense when many components share state across deep trees, but the V4 UI is essentially one main component plus a small handful of nested ones (chips, panes, expandable). No deep tree to coordinate across; the library would be overhead. C separates the two kinds of state cleanly — server state (anything that comes from an API) goes to TanStack; local UI state (anything that exists only in the browser) goes to `useState`.

**What would change this decision:** Component tree growing deep enough that prop-drilling for shared local state becomes painful — would add Zustand or React context, not replace TanStack Query. Not foreseeable at chunk-2 scope.

**Forward link:** When chunk 3 widens the verdict union to include `refuse_out_of_scope` (Q4's first non-additive schema change), TanStack Query's typed query function makes the discriminated union narrow cleanly at the component boundary. With A, every consumer would need manual updates.

---

## Q7 — Scaffold tooling (resolved before build step 1)

**Two sub-decisions, settled in the pre-build review of CC's scaffold plan:**

1. **How to scaffold into a non-empty folder.** `create-next-app` refuses to scaffold in place because `Project/` already holds chunk-1 artifacts. Decided: scaffold in a temp dir with non-interactive flags, relocate generated files into `Project/`, exclude the scaffold's `README.md`/`CLAUDE.md`/`AGENTS.md`/`.git` to avoid clobbering chunk-1's `README.md` or initializing an unwanted repo.

2. **Tailwind v3 vs v4.** `create-next-app` ships Tailwind v4, which is CSS-first (`@theme` in CSS) and has no `tailwind.config.ts`. The spec calls for `tailwind.config.ts` reading `tokens.ts` — the v3 model. Decided: pin Tailwind v3. The TypeScript tokens file is the diff-able ground-truth the rest of the system critiques against; v4's CSS-first model breaks that.

**Reasoning:** Both decisions trade modernity for spec fidelity and ground-truth preservation. Cost and latency flat. The TS-tokens diff-ability point is the real load-bearing rationale.

**What would change these:** v4 becoming load-bearing in chunk 7's polish work (e.g., for performance optimizations only it enables), or a tooling change making in-place scaffold possible (would simplify decision 1 without invalidating it).

**Additional note:** Next 16 forces Turbopack on `dev` despite `--no-turbopack`. Not a problem — Tailwind v3 + PostCSS compile fine under it. Flagged so future debugging of the build pipeline isn't surprised by it.

---

## Q8 — Embedding model for channel-1 (runbook similarity retrieval)

**Question:** Q1 locked channel 1 as embedding search over the runbook corpus. Which embedding model computes those vectors? (The cosine score it produces feeds the evidence-sufficiency gate at step 7 and must score low on off-domain queries so the system escalates gracefully — and so Seed 5's refusal has a clean signal in chunk 3.)

**Options considered:**

- **A. Voyage AI (`voyage-4-lite`).** Anthropic's recommended embedding partner. REST over `fetch`, no SDK. Current-generation lite tier; free tier covers the capstone. One new key (`VOYAGE_API_KEY`).
- **B. OpenAI (`text-embedding-3-small`).** Equivalent integration and quality for this task; needs a separate OpenAI key/account.
- **C. Local / in-process (Transformers.js, `all-MiniLM-L6-v2`).** Zero keys, runs offline, single-process cloneability. Heavier dependency (onnxruntime) + a model download + known Next.js/Turbopack native-binary bundling friction.

**Decision:** A — Voyage, model **`voyage-4-lite`**, called over REST with Node's global `fetch` (no SDK dependency).

**Reasoning:** Cost / latency / accuracy do **not** distinguish the options at one-page-corpus scale — pennies-to-free, sub-200ms inside a 3–8s diagnosis call, and any of the three trivially separates an in-domain query from an off-domain one. The deciding axis is integration friction + dependency surface + ecosystem signal. Voyage is a ~20-line `fetch` wrapper (Node's global `fetch` → **zero new npm packages**), is Anthropic's officially recommended embedder (ecosystem fluency a technical reviewer registers — the same logic as the Glean UI mimicry), and Sid already manages API keys, so the one marginal cost (a second key) is cheap. C's zero-key cloneability is genuinely appealing, but the Next/Turbopack native-binary bundling is exactly the out-of-scope time-sink the chunk fences against.

**Two spec/proposal corrections caught during this decision** (named explicitly — same provenance discipline as chunk 1's corrections, not silent fixes):

1. **The spec listed "Anthropic" as an embedding option.** Anthropic has **no embeddings API** and officially recommends Voyage. The real field is Voyage / OpenAI / local; the "Anthropic" option does not exist.
2. **CC's own proposal said `voyage-3.5-lite`.** Verified against Voyage's docs (embeddings page + pricing + API reference): `voyage-3.5-lite` is now under "older models" with **no free tier**; the current-generation lite is **`voyage-4-lite`**, which is on the free tier (200M tokens — the capstone uses ~1%). Identifier order confirmed as `voyage-4-lite` (not `voyage-lite-4`) against the API reference's recommended-options list.

**What would change this decision:** Corpus growth to a scale where local inference's zero-marginal-cost beats per-call API pricing, or a need for offline/air-gapped operation (revisit C); a Voyage outage or free-tier removal (swap to B — the integration is the identical `fetch` shape).

**Dependency note:** Integration is REST via Node's global `fetch` — **no npm package installed**, so the "verify nothing else snuck in" surface is unchanged from step 2. Requires `VOYAGE_API_KEY` in `.env.local` (Sid supplies; gitignored, never committed).

---

## Q9 — Chunking strategy for the runbook corpus

**Question:** How is the runbook corpus chunked before embedding (channel 1)?

**Course frame (Deepak 8.2.5):** Chunking has three axes — **chunk size**, **overlap**, **content type**. Overlap is taught as a vital technique to preserve chunk *completeness* across boundaries: a fact split by a boundary survives intact in at least one chunk.

**Options considered:**

- **A. Whole-page, no overlap.** Chunk size = document size; with no internal boundaries there is no overlap to apply.
- **B. Sub-chunk by heading/paragraph, with overlap.** Several vectors per page, overlapping windows across boundaries.
- **C. Fixed-size sliding window, with overlap.** N-token chunks, M-token overlap, boundary-agnostic.

**Decision:** A — whole-page (chunk size = document size), no overlap.

**Reasoning:** The chunk-2 corpus is one ~300-word page on a single mechanism. Whole-page is the **limit case** of Deepak's completeness principle (8.2.5), *not* a deviation from it: with chunk size = document size there are no internal boundaries, so there is nothing for overlap to preserve completeness across — the entire mechanism lives in one vector, intact. Sub-chunking (B/C) would fragment a single coherent mechanism across vectors; because the evidence-sufficiency gate reads the *top* score, that fragmentation can push the best match below the 0.5 threshold for a query that matches the page as a whole. Content type (the third axis) is uniform prose — no type-specific handling applies. Cost and latency are flat (one short page either way), so they don't distinguish.

**What would change this decision:** A page — current or future — growing long enough, or multi-topic enough, that it must be split. At that moment **overlap becomes the default, not a consideration**: per 8.2.5, use overlap unless there's a specific reason not to. Chunking would shift to by-heading (B) with an overlap window to preserve completeness across the newly-introduced boundaries.

---

## Q10 — Embed-timing: when is the corpus embedded?

**Question:** When does channel 1 embed the runbook corpus — at module load, lazily on first query, or per-request?

**Course frame (Deepak 8.1.5 Q&A / 8.1.1 Step 3):** Embedding is **pre-processing**, structurally separate from retrieval runtime — the search-architecture analogy (build the index ahead of time), not the LLM analogy (compute on demand). The three options map to this principle **by degree of alignment**:

- **Module-load embed** — strongest: pre-processing fully completes before any retrieval.
- **Lazy + memoized** — pragmatic compromise: pre-processing happens once, deferred into the first retrieval.
- **Per-request embed** — violates the principle: conflates pre-processing with retrieval.

**Decision:** Lazy + module-scope memoized. The corpus embeds on the first query and is cached for the process lifetime.

**Reasoning:** Per-request is out — it conflates pre-processing with retrieval (re-embeds the corpus on every diagnosis), the direct violation of 8.1.5's separation. Between the two principle-aligned options, module-load is the strongest expression but, in Next's runtime, couples module *import* to a network call: brittle when the key is absent at import time, and Next's module graph + dev HMR re-import modules, multiplying the coupling. Lazy + memoized preserves the principle's substance — embedding happens exactly once, cached for the process lifetime; retrieval runtime never re-embeds — while deferring the work into the first retrieval call, where the key is reliably present and the one-time cost is paid once. Cost and latency are identical in steady state (one embed per process either way); the only difference is *when* the one-time cost lands. Engineering pragmatism picks the compromise.

**What would change this decision (when to invoke the fuller principle):** The chunk-7 Vercel serverless deploy. There, each cold instance is a fresh process, so "once per process" becomes "once per cold start" — the first request to each instance re-pays the embed, and the pre-processing/retrieval separation Deepak teaches becomes *visible* as cold-start latency. The fuller application of 8.1.5 is then to move embedding fully out of runtime: **precompute the corpus embeddings to a file at build time** and load the vectors at module init. Deferred now for engineering pragmatism (one page, local dev, invisible cost); becomes the natural next step exactly when serverless makes the boundary observable.

---

## Q11 — Tool-use structure: how the model emits the diagnosis

**Decision:** Two tools — `resolve` and `escalate` — with `tool_choice: {type: "any"}` forcing the model to call exactly one. The verdict *is* which tool fired. Each tool's `input_schema` enforces the required fields for that variant (`resolve` → `root_cause` + `diagnosis_text`; `escalate` → `owner` + `diagnosis_text`), and `root_cause` is a closed `enum` of the canonical labels. This is chosen over a single tool with a conditional `oneOf` schema, whose required-field-per-variant constraints Anthropic tool-use enforces only weakly. Cost / latency / accuracy are flat (static tool definitions, one call either way) — the deciding axis is enforcement strength and the facts/judgment boundary below.

**Reasoning — the judgment/fact split.** The tool emits **only the judgment fields**: verdict (via which tool), `root_cause`/`owner`, and `diagnosis_text`. The system populates the **fact fields** — `retrieved_evidence` (from the retrieval result) and `gate_signals` (from the gate, step 7) — when it assembles the full `DiagnosisOutput`. The model never self-reports what was retrieved or whether the gate passed; those are checks *on* the model, owned by code, and letting the model emit them would be it grading its own homework (chunk 1's "facts owned by code, judgment owned by author/model"). The closed `root_cause` enum is the teeth behind Q4's authoring rule: the model **cannot** emit a non-canonical label, so when nothing matches its only escape is to call `escalate` — "never invent a label → escalate instead" enforced structurally, not by prompt-begging. What would change this: a future need for a verdict that carries fields the current two tools can't express without conditional logic (handled by adding a tool, not by collapsing to `oneOf`).

**Forward link — chunk 3's third tool.** Seed 5 (out-of-scope) adds a third tool, `refuse`, carrying neither `root_cause` nor `owner` — only a scope-perimeter explanation. `tool_choice` stays `"any"` across the three tools; verdict still equals which tool fired. This is the schema's first non-additive widening (per Q4's forward-link to `refuse_out_of_scope`), and the two-tool → three-tool structure absorbs it cleanly: add a tool, the discriminated union gains a third arm, the existing two are untouched. The grader and UI widen to handle the third arm; the diagnosis call's structure does not restructure.

---

## Q12 — Gate → verdict interaction: what a failed gate signal does

**Decision:** Gate as **override**. Both signals — sufficiency and consistency — must pass for a model `resolve` to stand; either one failing forces the final verdict to `escalate`. The `gate_signals` object records each signal's pass/fail in the output so the V4 left pane shows what fired (`sufficiency=pass, consistency=pass` on Seed 1; the failure on an off-domain query). Chosen over **advisory** (signals shown but verdict unchanged — fails the done-criterion, since "weather" must escalate *because* sufficiency fails, spec line 237) and over **sufficiency-only override** (leaves the consistency signal decorative).

**Reasoning:** The gate is a backstop *on* the model — the mechanism that makes the chunk-1 thesis real (confident-but-unreliable diagnoses get caught). Sufficiency fail = not enough relevant evidence to trust a resolve. Consistency fail = the model isn't stable on its own answer. Cost / latency / accuracy don't distinguish the options (the signals are computed regardless; this is only about what their result *does*). The deciding axis is whether the gate has teeth: only override gives it any.

**Fallback-owner mechanic:** When the gate forces a `resolve` → `escalate`, the model supplied no `owner` (it called the `resolve` tool). The forced escalation routes to an **authored constant** `FALLBACK_ESCALATION_OWNER` (e.g. `"human-reviewer"`) in `lib/escalation.ts` — a sibling of `canonical-labels.ts`, and a home that grows when Seed 4's contested-routing lands in chunk 6. Authored, not generated (facts/judgment discipline). In chunk-2's two test cases this path rarely fires: on off-domain input the model **self-escalates** (the system prompt instructs escalate-on-insufficient-evidence) and supplies its own owner while sufficiency fails in parallel — the two agree. The fallback exists so the "model resolved, gate overrode" case is still coherent.

**Diagnosis-augmentation behavior:** On a gate override of a model-`resolve`, the system **prepends a short honest note** to `diagnosis_text` (wording content-shaped, finalized at write — e.g. "Gate override: insufficient evidence to resolve confidently — escalating for human review."). Without this, the V4 left pane would show an escalation carrying the model's *resolve* reasoning, which reads as confused. The note makes the override legible.

**What would change this decision:** A later chunk wanting the gate to **re-prompt** the model to produce a proper escalation (real owner + reasoning) instead of using a fallback constant — a richer recovery loop (the State-Machine autonomy upgrade flagged in chunk 1's VALIDATION-NOTES §4), deferred as out-of-scope here.

---

## Q13 — Evidence-sufficiency threshold (Q3's 0.5 placeholder), measured

**Decision:** Sufficiency passes iff the top runbook similarity (`topScore`) ≥ **0.21**. The value was measured, not guessed, against `voyage-4-lite` on 2026-06-12.

**Measured numbers (voyage-4-lite, 2026-06-12):**

- in_domain (Seed-1 symptom vs runbook): **0.3875**
- off_domain ("what's the weather" vs runbook): **0.0236**
- gap: 0.364
- threshold = round((0.3875 + 0.0236) / 2, 2) = **0.21** (sits clearly above off_domain, below in_domain)

**Diagnostic matrix (what each row rules out):** the in_domain score landed under the 0.40 sanity floor, so before locking, a model × query-phrasing matrix isolated the cause:

| model | symptom query | clean mechanism query |
|---|---|---|
| voyage-4-lite | 0.387 | 0.703 |
| voyage-4 | 0.430 | 0.710 |
| voyage-4-large | 0.407 | 0.631 |

- The **clean (mechanism-phrased) column** scores 0.63–0.70 across all models → the **runbook page is sound**; this is not a page-coverage gap.
- The **symptom column stays ~0.39–0.43 even at `voyage-4-large`** → a bigger model barely moves it; this is not a weak-embedder problem.
- The ~0.31 spread between the two columns on the same model isolates the cause to the **query, not the model or the page.**

**Isolated cause — symptom↔mechanism vocabulary distance (course ref Deepak 8.2.6).** The operator's symptom ("can't open the folder, she's in data-team, can you look?") is phrased in *symptom* language; the runbook is phrased in *mechanism* language ("nested-group inheritance, access propagation, direct membership"). 8.2.6's query/document vocabulary-mismatch problem: relevant documents score only moderately against queries that don't share their vocabulary. Operators describe symptoms, not mechanisms, so raw-symptom retrieval sits low by nature.

**Named chunk-7 fix — query transformation (HyDE).** The structural fix is to transform the raw symptom before embedding — either rewrite it into a mechanism-oriented query or generate a hypothetical runbook-style passage (HyDE) and embed *that*. The clean-query column (~0.70) is the headroom this would unlock. Deferred to chunk 7 (robustness/polish) rather than added now: it is new machinery (+1 LLM call per diagnosis) and a modification to the locked Q1 channel-1 design — "just also add..." territory the chunk fences against.

**Tripwire interpretation — the floor worked.** The 0.40 in_domain floor was a *stop signal*, not a tuning input. It fired correctly: it caught a real problem — just an **unenumerated third condition** (query↔document vocabulary distance) rather than the two it was written to anticipate (weak model / weak page). Stopping on it produced the diagnostic above instead of a silently-tuned threshold. That is the floor doing exactly its job.

**What would change this decision:** Chunk-7 query transformation lifting the in_domain score into the ~0.70 band would re-derive the threshold against the new distribution. Any change to `scenario.json`'s symptom text also invalidates the calibration (see VALIDATION-NOTES §4) — the threshold is anchored to that exact string.

---

## Q14 — Consistency signal: mechanism + N (Q3's N=3 placeholder), measured

**Decision:** Self-consistency sampling. Run the diagnosis **N=3** times in parallel at **temperature 0.7**; the **modal decision wins** and becomes the primary output; consistency passes under a **majority rule** (modal count ≥ ⌈N/2⌉ → ≥2 of 3). Measured and locked against `claude-sonnet-4-6` on 2026-06-12.

**Mechanism.** The agreement key is the *decision identity*, not the prose: a resolve is identified by its `root_cause`, an escalate by the verdict alone; `diagnosis_text` varies naturally and never counts. Majority (not unanimous) is deliberate: at non-zero temperature a single outlier sample on a clear case would fail a unanimous rule and break the done-criterion via the Q12 override; majority absorbs one outlier (2-1 passes) while still catching genuine flip-flopping (1-1-1 fails, or a 2-1 against the expected answer). N=3 is the smallest count that breaks ties and absorbs one outlier; cost is 3× calls per diagnosis, parallel so latency ≈ one call (anticipated by Q3). Cost/latency/accuracy don't distinguish alternatives meaningfully at this scale — the deciding axes were done-criterion safety (majority over unanimous) and signal viability (non-zero temperature, or the signal can never catch anything).

**Measured numbers (claude-sonnet-4-6, temp 0.7, 2026-06-12):** Seed-1 symptom, 3 samples → **3/3 `resolve / nested_subgroup_inheritance_gap`** → consistency **pass** (modal count 3 ≥ 2). Temperature 0.7 did not destabilize the clear case, so it locks as-is (the Q13 measure-then-lock discipline, applied to temperature). Dial down only if a clear case later destabilizes.

**Honest caveat — catch-behavior armed but unvalidated.** Chunk 2 has **no borderline/ambiguous seed**, so only the consistency gate's *pass-on-a-clear-case* behavior is exercised. Its *catch-an-unstable-case* behavior (the 1-1-1 or adverse-2-1 → fail → override path) is armed but unexercised until a chunk-5+ seed with genuine ambiguity exists. This mirrors chunk 1's "strict-parser path armed but not exercised" note — the mechanism is built and type-correct, but its triggering case hasn't fired in a real run. Recorded in VALIDATION-NOTES §4.

**Course-citation honesty.** There is **no direct Deepak section on self-consistency sampling.** Adjacent concepts in the same "don't trust the first answer" family exist — reflection (6.2.3), self-RAG (8.2.7), disagreement-rate triangulation in golden datasets (5.3.1) — but they are different mechanisms. The technique used here is **standard from the broader literature (Wang et al. 2022, "Self-Consistency Improves Chain of Thought Reasoning")**, not from the course. Named as such — same discipline as chunk 1's deviation acknowledgments: when applying something that isn't in the course, say so.

**What would change this decision:** A clear case destabilizing at temp 0.7 (dial temperature down). The arrival of a genuinely ambiguous seed (chunk 5+) that lets the catch-behavior be validated, and possibly tuned (N up for a finer majority, or temperature up for a more sensitive signal). A model swap off `claude-sonnet-4-6` to one that rejects `temperature` (Opus 4.x / Fable) would break the sampling and force a different consistency mechanism.

---

## Q15 — API response style: blocking or streaming?

**Decision:** Blocking. The `/api/diagnose` route runs retrieval + the 3 diagnosis samples + the gate, and returns the complete `DiagnosisOutput` JSON when ready.

**Reasoning:** Streaming is **structurally incompatible** with the self-consistency gate (Q14), not merely more complex. The verdict is a majority vote across 3 *completed* samples plus gate evaluation — there is no single token stream to surface, because the answer does not exist until all samples finish and the vote resolves. Streaming would only fit if consistency dropped to N=1 and we streamed that one `diagnosis_text`, which would gut the gate. So blocking is the shape the design dictates. The "feels alive" need during the 3–8s wait belongs to the **loading affordance** (open question #7, step 9 content), not to the transport. TanStack Query's `useMutation` handles the blocking request lifecycle (loading/error/success) cleanly (Q6).

**What would change this decision:** Dropping consistency to N=1 and wanting token-level streaming of the single diagnosis — trades away the gate; not chunk-2. (App-router + `useMutation` could adopt streaming later without a transport rewrite if a future chunk justified it.)

---

## Q16 — Error-response contract for `/api/diagnose`

**Decision:**
- **Success:** `200` + the `DiagnosisOutput` JSON (Q4).
- **Failure:** non-2xx + `{ error: string }` (plain, human-readable). `400` for invalid input (malformed JSON body, missing/empty `symptom`); `500` for upstream/internal failure (Voyage or Anthropic down, missing key, malformed/absent tool call).

**Errors are a separate channel from `DiagnosisOutput`.** "Retrieval returns nothing relevant" (the weather case — low similarity, empty status) is **not** a failure; it is a valid `sufficiency=fail → escalate`, a normal `DiagnosisOutput`. Only genuine failures — API down, missing key, no valid tool call — hit the error channel.

**Fail-loud, one altitude up.** A system crash must **never** be dressed up as an `escalate`. Catching an Anthropic/Voyage error and returning a fabricated escalation would conflate "the system broke" with "the system decided to escalate" — the *same* conflation chunk 1's Q3 strict-parse rejected at the judge boundary ("the judge malfunctioned" vs "the criterion was not met"), now applied at the API boundary. So failures get their own response shape and HTTP status; the UI renders an *error state*, not an escalation card. Implementation consequence: input validation is a `400` guard *before* the pipeline `try/catch`, so bad input can never be swallowed into the upstream `500` path; the `try` wraps only `retrieve → gate`.

**Granularity — MVPerf.** A single `{ error: string }`, not an error-code enum. Chunk 2's one generic error state ("something went wrong, try again") needs only a displayable message. **What would change this:** the UI needing to branch behavior by error kind (retryable vs fatal), at which point a `code` field is added additively.

---

## Q17 — Running the chunk-1 grader against the system's Seed-1 output

**Question:** The done-criterion is the chunk-1 ruler passing the system's *real* Seed-1 output. The grader (`eval/src/validate.ts`) hardcodes loading `good.json` + `wrong.json` and regenerates VALIDATION-NOTES §1–2 on success, and `eval/` is fenced "do not modify." How do we grade the system output through it?

**Options considered:**

- **A. Swap-and-restore `good.json`.** Back up `good.json`, overwrite with the system output, `npm run validate`, restore. Most literal (`npm run validate`), and re-confirms the ruler still fails `wrong.json` in the same run. But it temporarily clobbers a chunk-1 artifact, and the success path rewrites VALIDATION-NOTES §1–2 with the system output's judge reasoning — mutating chunk-1's facts. Requires backing up + restoring both `good.json` and `VALIDATION-NOTES.md`.
- **B. CLI-arg on `validate.ts`** (`npm run validate -- --output <path>`). Clean separation, no artifact clobber — but modifies the fenced-off grader file.
- **C. Sibling runner.** A new `eval/src/grade-system-output.ts` imports the *unchanged* ruler (`gradeOutput` + judges + `scenario.json`'s `expected_answer`), grades `agent-outputs/seed-1-system-output.json`, and prints in chunk-1's exact console format.

**Decision:** C. The spec sanctions "running grading on the new file directly"; C does exactly that with the **exact ruler logic** (same `gradeOutput`, same `claude-sonnet-4-6` judges, same scenario `expected_answer`), modifies **no existing grader file**, and touches neither `good.json` nor VALIDATION-NOTES. Cost/latency are flat across all three; the deciding axis is zero side-effects on chunk-1 artifacts while using the unchanged instrument. A is the most literal but mutates two chunk-1 artifacts; B edits the file the spec fences off. Output mirrors chunk-1's validation log exactly (same per-field labels, `→ RULER PASSES ✓`) so the chunk-1 and chunk-2 logs read as one instrument.

**What would change this decision / forward link (chunks 3–6):** If grading real system outputs against the ruler becomes a recurring need across multiple seeds and chunks, a first-class CLI arg on `validate.ts` (option B) becomes the right shared pattern — build it then, deliberately, as a considered change to the ruler's interface, not improvised here. For chunk 2's single seed, the sibling runner is the minimal honest tool; it does not foreclose B later.

---

## Discipline carry-over from chunk 1

These remain non-negotiable through chunk 2's build:

- **Facts owned by code, judgment owned by author.** The system's output (Q4 schema) is mechanical; copy in the framing line, the refusal explanation, the "how this decides" expandable, the canonical root_cause label list is authored — not generated, not extracted from a model.
- **Real-time provenance.** This file is the provenance for Q1–Q6. Build-phase decisions (Q7 onward) get logged here at the moment they're made, in the same format, before moving to the next decision. Not summarized after.
- **Disjointness.** Each chunk tests one mechanism at full strength; every other mechanism at zero. Don't bake chunk-3 or chunk-5 work into chunk-2 implementation.
- **Course deviations acknowledged.** If a chunk-2 build decision contradicts an AIPM-course-taught principle, the entry must name the deviation explicitly and justify it. Don't sneak past course principles silently.
- **MVPerf framing.** Build the minimum needed to demonstrate the thesis for this chunk's mechanism. Refuse to broaden scope. Expand seed by seed.

---

## Q18 — Late-build catch: `owner` field tightened to canonical enum (parity with Q11)

**Surfaced by:** post-retrofit code review. The SID-42 and SID-43 retrofits worked the discipline of "structural enforcement of facts/judgment boundaries" through chunk 2's surface area. That re-walk made a long-tolerated asymmetry visible: Q11 closed `root_cause` to the `CANONICAL_ROOT_CAUSES` enum so the model cannot invent a label, but Q4's `owner: string` was left open — the model could fabricate any team name and the system would route there silently. Same failure-mode class; only one half closed.

**Question:** how should `owner` be constrained, given that (a) the model picks it when calling the `escalate` tool, and (b) the system independently sets `FALLBACK_ESCALATION_OWNER` ("human-reviewer") when the gate overrides a model-resolve into an escalate (Q12)?

**Options considered:**

- **A. Defer to chunk 6.** Q4's forward-link already anticipated chunk 6's contested-routing refactor (`routing: {state, owners, recommended}`). Wait for that work and close the asymmetry there.
- **B. Single closed enum including the fallback.** Add `human-reviewer` to the canonical list; remove the separate `FALLBACK_ESCALATION_OWNER` distinction. One source of truth.
- **C. Two structurally distinct sources, both closed.** `CANONICAL_ESCALATION_OWNERS` (closed enum, model-facing — wired into the escalate tool's `input_schema`) and `FALLBACK_ESCALATION_OWNER` (system-only constant, never in the model's tool schema, used only on gate override). The escalate variant of `DiagnosisOutput` types `owner` as the union of the two.

**Decision:** C.

**Reasoning:** A leaves the asymmetry visible in the codebase for chunks 3, 4, 5 — exactly the kind of "we'll get to it" gap a thoughtful reviewer would ask about, and the disciplinary cost of carrying that gap forward exceeds the 15 minutes the fix takes. B over-merges semantically distinct concerns: `human-reviewer` means "the system overrode a confident resolve and we don't trust either the diagnosis or the routing" — that meaning is specifically NOT something the model should ever pick when it decides to escalate. Collapsing the two would let the model emit `human-reviewer` on its own escalations, which loses the override-vs-self-escalate signal Q12 is built on. C preserves Q12's semantics intact while bringing `owner` to parity with Q11's `root_cause` discipline: the model is structurally constrained (input_schema enum, type-narrow guard in `parseToolCall`); the system retains its independent fallback path.

**The four canonical owners (chunk-2 starting set):**

| Owner | Authority class |
|---|---|
| `identity-team` | User accounts, group memberships, SSO/IdP, provisioning. Seed 1's nested-subgroup case routes here if escalated. |
| `resource-owner` | The specific resource's owner (e.g., Drive folder owner). Routes here when access depends on the resource owner explicitly granting it. |
| `security-team` | Security policy, DLP, conditional access, compliance gates. Routes here when a security policy is blocking, not a permissions misconfiguration. |
| `support-team` | Generic IT support. The within-enum catchment for issues that don't cleanly fit any specialist authority class. |

Plus `FALLBACK_ESCALATION_OWNER = "human-reviewer"` — system-only.

**Named asymmetry-with-Q11 that survives this fix (and why):** Q11's root_cause enum has no within-enum catchment — when no label fits, the model MUST call `escalate` (a different tool). Q18's owner enum does have one (`support-team`). The structural reason: `escalate` is itself the fallback verdict; the model has already decided not to resolve, and the diagnosis still needs a routing destination even when no specialist owner is the right answer. There is nowhere "further" to escalate to. The within-enum catchment is the right shape for owner specifically because of escalate's terminal position in the verdict tree; not the right shape for root_cause because resolve is not terminal — escalate exists as the structural fallback path.

**Forward link to chunk 6 (Q4's existing link, unchanged in shape, updated in context):**

Chunk 6's contested-routing work (Seed 4) was always going to refactor `owner: <enum>` into the richer `routing: { state: "clear" | "contested", owners: CanonicalEscalationOwner[], recommended: CanonicalEscalationOwner }` shape Q4 forward-linked. Q18 doesn't conflict with that plan — it just promotes the field from `string` to `CanonicalEscalationOwner` so the refactor is type-aligned from day one rather than starting from a wider type. Chunk 6 may also extend `CANONICAL_ESCALATION_OWNERS` itself (add owners; the four-owner starting set is not pre-committed to be complete for all seeds).

**Cross-chunk discipline acknowledgement.** Q18 modifies fenced chunk-2 code (`lib/escalation.ts`, `lib/schema.ts`, `lib/diagnosis.ts`), which is non-trivial — the fence existed to prevent silent Q1–Q17 drift. This is not silent drift: Q18 is a new design decision, with reasoning, that explicitly amends Q4 (`owner` type) and Q11 (extends the closed-enum discipline). The disciplined path for fence-modification is a new Q entry, logged before code; that is this entry. Same shape as the SID-42 retrofit's Q8 entry — surfaced flaw, structural reason, named fix, future invalidation conditions.

**What would change this decision:** Chunk 6's contested-routing work landing first, before Q18's code change ships — in which case Q18's enum + types would be authored as part of chunk 6's design rather than as a chunk-2 amendment. Sequence is the only thing that flips; the substance is the same either way.

**Re-validation needed:** none for chunk-2's existing demo flow. The model's chunk-2 behavior on Seed 1 (resolve → no owner emitted; gate override → fallback to "human-reviewer") is structurally unchanged. On the off-domain "what's the weather" case (chunk-2 design decisions Q12, where the model previously self-supplied "support-team" against an open string), the model now must pick from the four-enum set; "support-team" remains in the enum, so the same routing decision is still available. If the chunk-2 demo is re-run after Q18 ships and the model picks a different owner from the enum on the off-domain case, that's informative — name it in the next VALIDATION-NOTES update, don't paper over it.
