// Gate signals — Q3's two signals + the Q12 override that gives them teeth.
//
//   Sufficiency (Q13): top runbook similarity ≥ threshold, else the evidence
//     wasn't relevant enough to trust a resolve.
//   Consistency (Q14): self-consistency sampling — run the diagnosis N times at
//     temperature, the modal decision wins, majority agreement = pass. (Standard
//     from the literature — Wang et al. 2022, "Self-Consistency Improves Chain of
//     Thought Reasoning" — adjacent in spirit to Deepak's reflection family
//     (6.2.3 / 8.2.7) but not directly named in the course materials.)
//
// Q12: gate as OVERRIDE. Both signals must pass for a model `resolve` to stand;
// either failing forces `escalate`. The model emits only judgment fields; this
// module merges them with the code-owned fact fields (retrieved_evidence,
// gate_signals) to assemble the full DiagnosisOutput (Q11 judgment/fact split).

import type {
  ApprovalAction,
  ConsistencyVotes,
  DiagnosisOutput,
  GateSignal,
  GateSignals,
  RetrievedEvidence,
} from "./schema";
import { diagnose } from "./diagnosis";
import type { DiagnosisJudgment } from "./diagnosis";
import type { RetrievalResult, StatusFacts } from "./retrieval";
import { FALLBACK_ESCALATION_OWNER } from "./escalation";

// --- Sufficiency (Q13) -------------------------------------------------------

// MEASURED, not guessed (voyage-4-lite, 2026-06-12):
//   in_domain  (Seed-1 symptom vs runbook) = 0.3875
//   off_domain ("weather"      vs runbook) = 0.0236
//   threshold = round((0.3875 + 0.0236) / 2, 2) = 0.21
// The in_domain score sits under the 0.40 sanity floor by design — that floor
// fired correctly on the symptom↔mechanism vocabulary distance (Q13, course
// 8.2.6); the chunk-7 fix is query transformation (HyDE). Re-derive if the
// scenario symptom text or the embedding model changes.
export const SUFFICIENCY_THRESHOLD = 0.21;

export function evaluateSufficiency(topScore: number): GateSignal {
  return topScore >= SUFFICIENCY_THRESHOLD ? "pass" : "fail";
}

// --- Consistency (Q14) -------------------------------------------------------

export const CONSISTENCY_SAMPLES = 3;
export const CONSISTENCY_TEMPERATURE = 0.7; // starting point, measure-then-lock (Q14)

// Agreement is on the DECISION IDENTITY, not the prose. A resolve is identified
// by its root_cause; an escalate by the verdict alone. diagnosis_text varies
// naturally and never counts toward agreement.
function agreementKey(j: DiagnosisJudgment): string {
  if (j.verdict === "resolve") return `resolve:${j.root_cause}`;
  return j.verdict; // "escalate" | "refuse_out_of_scope" — each verdict its own key
}

// Run the diagnosis N times in parallel at temperature (latency ≈ one call).
export function sampleDiagnoses(
  symptom: string,
  context: RetrievalResult,
  n: number = CONSISTENCY_SAMPLES,
  temperature: number = CONSISTENCY_TEMPERATURE,
): Promise<DiagnosisJudgment[]> {
  return Promise.all(
    Array.from({ length: n }, () => diagnose(symptom, context, { temperature })),
  );
}

// Majority rule: the modal decision passes iff it holds ≥⌈N/2⌉ of the samples
// (N=3 → ≥2). One outlier is absorbed; a flip-flop (1-1-1, or a real 2-1 split)
// fails. The modal sample becomes the primary output.
export function evaluateConsistency(samples: DiagnosisJudgment[]): {
  signal: GateSignal;
  primary: DiagnosisJudgment;
  votes: ConsistencyVotes;
} {
  const counts = new Map<string, number>();
  for (const s of samples) {
    const k = agreementKey(s);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let modalKey = "";
  let modalCount = 0;
  for (const [k, c] of counts) {
    if (c > modalCount) {
      modalKey = k;
      modalCount = c;
    }
  }
  const majority = Math.ceil(samples.length / 2);
  const signal: GateSignal = modalCount >= majority ? "pass" : "fail";
  const primary =
    samples.find((s) => agreementKey(s) === modalKey) ?? samples[0];
  return {
    signal,
    primary,
    votes: { agree: modalCount, total: samples.length },
  };
}

// --- Q12 override + assembly -------------------------------------------------

// Content (post-write review): the honest note prepended to diagnosis_text when
// the gate overrides a model-resolve, so the V4 left pane explains the override
// rather than showing an escalation carrying resolve reasoning.
function overrideNote(sufficiency: GateSignal, consistency: GateSignal): string {
  const reasons: string[] = [];
  if (sufficiency === "fail")
    reasons.push("the retrieved evidence wasn't relevant enough to resolve confidently");
  if (consistency === "fail")
    reasons.push("the diagnosis wasn't stable across repeated checks");
  return `Gate override: ${reasons.join(" and ")} — escalating for human review.`;
}

function stripScores(runbook: RetrievalResult["runbook"]): RetrievedEvidence[] {
  return runbook.map(({ source, snippet }) => ({ source, snippet }));
}

// SID-70: derive the admin action for an escalate, deterministically from the
// committed status_facts (NOT the model). If the requester is missing a group the
// resource grants to, the closed loop can provision it (add_to_group); otherwise
// it needs human judgement and routes to a team (team_routing). Re-keyed
// "user:"/"group:" ids are resolved to real Okta ids later, at approval time.
function deriveApprovalAction(
  status: StatusFacts,
  owner: string,
): ApprovalAction {
  // add_to_group is the PROVISIONING action, which this system routes to the
  // identity team. Gating on owner keeps inquiry/recommendation/security/support
  // escalates (which may incidentally show a group-gap in status_facts) from being
  // mis-derived as approvable — those need human judgement → team_routing.
  if (owner === "identity-team") {
    const user = status.users[0];
    if (user) {
      const nameOf = new Map(status.groups.map((g) => [g.id, g.name]));
      for (const r of status.resources) {
        for (const grant of r.grants) {
          if (
            grant.principal.startsWith("group:") &&
            !user.direct_group_memberships.includes(grant.principal)
          ) {
            return {
              type: "add_to_group",
              user_id: user.id,
              group_id: grant.principal,
              group_name:
                nameOf.get(grant.principal) ??
                grant.principal.replace(/^group:/, ""),
            };
          }
        }
      }
    }
  }
  return { type: "team_routing", team: owner, slack_channel: owner };
}

// Combine the primary judgment with both signals to produce the final output.
export function applyGate(params: {
  // Refuse skips the gate (short-circuited upstream in runGatedDiagnosis), so
  // applyGate only ever sees a resolve or escalate primary — the gate is the
  // resolve-confidence mechanic, and a refuse has no resolve to verify.
  primary: Exclude<DiagnosisJudgment, { verdict: "refuse_out_of_scope" }>;
  sufficiency: GateSignal;
  consistency: GateSignal;
  evidence: RetrievedEvidence[];
  consistency_votes: ConsistencyVotes; // self-consistency tally (SID-46 B.1)
  top_similarity: number; // top runbook cosine, surfaced to the UI (SID-46 B.1)
  status_facts: StatusFacts; // identity-graph slice for the reasoning trace (SID-48 B)
}): DiagnosisOutput {
  const {
    primary,
    sufficiency,
    consistency,
    evidence,
    consistency_votes,
    top_similarity,
    status_facts,
  } = params;
  const gate_signals: GateSignals = { sufficiency, consistency };
  // Code-owned fact fields shared by every resolve/escalate output (Q11 split).
  const facts = {
    retrieved_evidence: evidence,
    gate_signals,
    consistency_votes,
    top_similarity,
    status_facts,
  };
  const gatePassed = sufficiency === "pass" && consistency === "pass";

  if (gatePassed) {
    if (primary.verdict === "resolve") {
      return {
        verdict: "resolve",
        root_cause: primary.root_cause,
        diagnosis_text: primary.diagnosis_text,
        ...facts,
      };
    }
    return {
      verdict: "escalate",
      owner: primary.owner,
      diagnosis_text: primary.diagnosis_text,
      ...facts,
      approval_action: deriveApprovalAction(status_facts, primary.owner),
    };
  }

  // A signal failed → force escalate.
  if (primary.verdict === "escalate") {
    // Model already escalated and supplied an owner; keep its reasoning. The
    // failed gate_signals already explain the escalation — no augmentation.
    return {
      verdict: "escalate",
      owner: primary.owner,
      diagnosis_text: primary.diagnosis_text,
      ...facts,
      approval_action: deriveApprovalAction(status_facts, primary.owner),
    };
  }
  // Override a model-resolve into escalate: fallback owner + augmented text.
  return {
    verdict: "escalate",
    owner: FALLBACK_ESCALATION_OWNER,
    diagnosis_text: `${overrideNote(sufficiency, consistency)}\n\n${primary.diagnosis_text}`,
    ...facts,
    approval_action: deriveApprovalAction(status_facts, FALLBACK_ESCALATION_OWNER),
  };
}

// --- Top-level: run the gated diagnosis --------------------------------------

// The route calls this after retrieveContext. Samples the diagnosis, evaluates
// both signals, and assembles the final DiagnosisOutput.
export async function runGatedDiagnosis(
  symptom: string,
  context: RetrievalResult,
): Promise<DiagnosisOutput> {
  // DiagnosisOutput now includes the refuse_out_of_scope variant (SID-46 A.1),
  // so the refuse short-circuit below returns a valid DiagnosisOutput directly.
  const samples = await sampleDiagnoses(symptom, context);
  const { signal: consistency, primary, votes } = evaluateConsistency(samples);

  // Q3b α (chunk 3): refuse short-circuits the gate. The gate verifies a resolve;
  // a refuse has nothing to verify. Return the judgment as-is, gate_signals omitted.
  // The schema-level DiagnosisOutput widening and the refuse UI treatment are
  // step-4 work — this keeps chunk-2 resolve/escalate behavior untouched.
  if (primary.verdict === "refuse_out_of_scope") {
    return primary; // SID-56 Phase 2: forward refuse_reason + missing_info as-is
  }

  const sufficiency = evaluateSufficiency(context.topScore);
  return applyGate({
    primary,
    sufficiency,
    consistency,
    evidence: stripScores(context.runbook),
    consistency_votes: votes,
    top_similarity: context.topScore,
    status_facts: context.status,
  });
}
