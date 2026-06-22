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

// Refuse taxonomy (SID-56 Phase 2). Three SIBLING reasons, not a hierarchy:
//   out_of_scope       — request isn't access diagnosis/inquiry/recommendation.
//   resource_ambiguity — in-scope, but which resource/account is unclear (REFUSE 1).
//   intent_ambiguity   — in-scope, but what the user was trying to do is unclear (REFUSE 2).
// The verdict discriminant stays "refuse_out_of_scope" (additive only — eval sets
// key on the verdict, not the reason, so they don't churn). For the two ambiguity
// reasons the model fills `missing_info` with the one specific thing it needs back.
export type RefuseReason =
  | "out_of_scope"
  | "resource_ambiguity"
  | "intent_ambiguity";

export type GateSignals = {
  sufficiency: GateSignal;
  consistency: GateSignal;
};

// Self-consistency vote tally surfaced to the UI (SID-46 B.1): how many of the
// N self-consistency samples agreed on the modal decision. Computed for every
// gated decision (resolve and gate-overridden escalate); refuse skips the gate.
export type ConsistencyVotes = { agree: number; total: number };

// SID-70: the action an admin can take on an escalate, derived deterministically
// at assembly time (lib/gate-signals.ts) from status_facts — NOT model-generated.
//   add_to_group  — a concrete provisioning the closed loop can execute: the user
//     isn't in a group the resource grants to. Approvable in-app (real Okta write).
//   team_routing  — requires human judgement beyond Cleared's reach. Stays in
//     Slack mode; slack_permalink is captured post-verdict (lib/notify.ts) for the
//     end-user "view in Slack" link (SID-66 → SID-70).
//
// SID-73: EVERY escalate now posts a Slack routing record (reverting the SID-70
// add_to_group→no-post evolution). The action SURFACE stays distinct — add_to_group
// is actioned in-app, team_routing out-of-band — but the routing RECORD is universal,
// so both members carry slack_permalink for the end-user "view in Slack" link.
export type ApprovalAction =
  | {
      type: "add_to_group";
      user_id: string; // re-keyed "user:<login-local>" — resolved to Okta id at approval time
      group_id: string; // re-keyed "group:<name>"
      group_name: string;
      slack_permalink?: string; // SID-73: routing-record permalink, attached by the route post-verdict
    }
  | {
      type: "team_routing";
      team: string;
      slack_channel: string;
      slack_permalink?: string; // attached by the route after the post (SID-70 Phase 2)
    };

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
      // SID-70: the admin action for this escalate, derived from status_facts at
      // assembly. Optional so frozen seed escalates (no field) type-check; only
      // live escalates carry it (seeds stay non-approvable by design).
      approval_action?: ApprovalAction;
    }
  | {
      // Refuse skips the gate (gate-signals.ts short-circuit) — no evidence,
      // signals, or diagnosis_text. Rendered by components/refusal-output.tsx
      // (admin) and components/end-user-card.tsx (end user). SID-56 Phase 2
      // widened this additively: `refuse_reason` classifies the three shapes;
      // `missing_info` carries the model's clarification ask for the two
      // ambiguity reasons (absent for out_of_scope — nothing is missing, it's
      // simply outside scope).
      verdict: "refuse_out_of_scope";
      refuse_reason: RefuseReason;
      missing_info?: string;
    };
