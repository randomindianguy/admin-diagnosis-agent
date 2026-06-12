// THE canonical contract. Referenced by: diagnosis tool-use (step 6), the
// /api/diagnose response (step 8), the UI components (step 9), and — via the
// exported shape — the chunk-1 grader (step 12). Drift here breaks everything
// downstream. Shape is locked by CHUNK2-DESIGN-DECISIONS Q4; do not widen for
// hypothetical future seeds (refuse_out_of_scope is chunk 3, etc.).
import type { CanonicalRootCause } from "./canonical-labels";

export type RetrievedEvidence = {
  source: string; // e.g., "nested-group-inheritance.md"
  snippet: string; // the relevant chunk text
};

export type GateSignal = "pass" | "fail";

export type GateSignals = {
  sufficiency: GateSignal;
  consistency: GateSignal;
};

export type DiagnosisOutput =
  | {
      verdict: "resolve";
      root_cause: CanonicalRootCause;
      diagnosis_text: string;
      retrieved_evidence: RetrievedEvidence[];
      gate_signals: GateSignals;
    }
  | {
      verdict: "escalate";
      owner: string;
      diagnosis_text: string;
      retrieved_evidence: RetrievedEvidence[];
      gate_signals: GateSignals;
    };
