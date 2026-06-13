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
  DiagnosisOutput,
  GateSignal,
  GateSignals,
  RetrievedEvidence,
} from "./schema";
import { diagnose } from "./diagnosis";
import type { DiagnosisJudgment } from "./diagnosis";
import type { RetrievalResult } from "./retrieval";
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
  return { signal, primary };
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

// Combine the primary judgment with both signals to produce the final output.
export function applyGate(params: {
  // Refuse skips the gate (short-circuited upstream in runGatedDiagnosis), so
  // applyGate only ever sees a resolve or escalate primary — the gate is the
  // resolve-confidence mechanic, and a refuse has no resolve to verify.
  primary: Exclude<DiagnosisJudgment, { verdict: "refuse_out_of_scope" }>;
  sufficiency: GateSignal;
  consistency: GateSignal;
  evidence: RetrievedEvidence[];
}): DiagnosisOutput {
  const { primary, sufficiency, consistency, evidence } = params;
  const gate_signals: GateSignals = { sufficiency, consistency };
  const gatePassed = sufficiency === "pass" && consistency === "pass";

  if (gatePassed) {
    if (primary.verdict === "resolve") {
      return {
        verdict: "resolve",
        root_cause: primary.root_cause,
        diagnosis_text: primary.diagnosis_text,
        retrieved_evidence: evidence,
        gate_signals,
      };
    }
    return {
      verdict: "escalate",
      owner: primary.owner,
      diagnosis_text: primary.diagnosis_text,
      retrieved_evidence: evidence,
      gate_signals,
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
      retrieved_evidence: evidence,
      gate_signals,
    };
  }
  // Override a model-resolve into escalate: fallback owner + augmented text.
  return {
    verdict: "escalate",
    owner: FALLBACK_ESCALATION_OWNER,
    diagnosis_text: `${overrideNote(sufficiency, consistency)}\n\n${primary.diagnosis_text}`,
    retrieved_evidence: evidence,
    gate_signals,
  };
}

// --- Top-level: run the gated diagnosis --------------------------------------

// The route calls this after retrieveContext. Samples the diagnosis, evaluates
// both signals, and assembles the final DiagnosisOutput.
export async function runGatedDiagnosis(
  symptom: string,
  context: RetrievalResult,
): Promise<DiagnosisOutput | { verdict: "refuse_out_of_scope" }> {
  const samples = await sampleDiagnoses(symptom, context);
  const { signal: consistency, primary } = evaluateConsistency(samples);

  // Q3b α (chunk 3): refuse short-circuits the gate. The gate verifies a resolve;
  // a refuse has nothing to verify. Return the judgment as-is, gate_signals omitted.
  // The schema-level DiagnosisOutput widening and the refuse UI treatment are
  // step-4 work — this keeps chunk-2 resolve/escalate behavior untouched.
  if (primary.verdict === "refuse_out_of_scope") {
    return { verdict: "refuse_out_of_scope" };
  }

  const sufficiency = evaluateSufficiency(context.topScore);
  return applyGate({
    primary,
    sufficiency,
    consistency,
    evidence: stripScores(context.runbook),
  });
}
