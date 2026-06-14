// THE canonical contract. Referenced by: diagnosis tool-use (step 6), the
// /api/diagnose response (step 8), the UI components (step 9), and — via the
// exported shape — the chunk-1 grader (step 12). Drift here breaks everything
// downstream. Shape is locked by CHUNK2-DESIGN-DECISIONS Q4; do not widen for
// hypothetical future seeds. The refuse_out_of_scope variant landed in chunk 3
// (SID-46 Phase A): a tagged-union member carrying ONLY its verdict — the refuse
// tool takes no input (Q3b α) and its user-facing copy is authored in
// components/refusal-output.tsx, so there are no fact fields to carry.
//
// Q18 update: the escalate variant's `owner` field is no longer an open string.
// It is the union of CANONICAL_ESCALATION_OWNERS (model-pickable) and
// FALLBACK_ESCALATION_OWNER (system-only, set on gate override). Parallel to
// Q11's closed-enum treatment of root_cause.
import type { CanonicalRootCause } from "./canonical-labels";
import type {
  CanonicalEscalationOwner,
  FallbackEscalationOwner,
} from "./escalation";
// type-only (erased at runtime → no schema↔retrieval cycle). The identity-graph
// slice is carried into the output for the SID-48 reasoning trace.
import type { StatusFacts } from "./retrieval";

export type RetrievedEvidence = {
  source: string; // e.g., "nested-group-inheritance.md"
  snippet: string; // the relevant chunk text
};

export type GateSignal = "pass" | "fail";

export type GateSignals = {
  sufficiency: GateSignal;
  consistency: GateSignal;
};

// Self-consistency vote tally surfaced to the UI (SID-46 B.1): how many of the
// N self-consistency samples agreed on the modal decision. Computed for every
// gated decision (resolve and gate-overridden escalate); refuse skips the gate.
export type ConsistencyVotes = { agree: number; total: number };

export type DiagnosisOutput =
  | {
      verdict: "resolve";
      root_cause: CanonicalRootCause;
      diagnosis_text: string;
      retrieved_evidence: RetrievedEvidence[];
      gate_signals: GateSignals;
      consistency_votes: ConsistencyVotes;
      top_similarity: number; // top runbook cosine similarity (retrieval channel 1)
      status_facts: StatusFacts; // identity-graph slice for the reasoning trace (SID-48 B)
    }
  | {
      verdict: "escalate";
      owner: CanonicalEscalationOwner | FallbackEscalationOwner;
      diagnosis_text: string;
      retrieved_evidence: RetrievedEvidence[];
      gate_signals: GateSignals;
      consistency_votes: ConsistencyVotes;
      top_similarity: number; // top runbook cosine similarity (retrieval channel 1)
      status_facts: StatusFacts; // identity-graph slice for the reasoning trace (SID-48 B)
    }
  | {
      // Refuse skips the gate (gate-signals.ts short-circuit) — no evidence,
      // signals, or diagnosis_text. Rendered by components/refusal-output.tsx.
      verdict: "refuse_out_of_scope";
    };
