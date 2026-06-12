// Shapes the ruler reads. Only the fields used for grading are modelled —
// the scenario's `setup` half is consumed by the agent, not the ruler.

export interface DiagnosisTextGrading {
  mode: string;
  criteria: string[];
  pass_rule: string;
}

export interface ExpectedAnswer {
  verdict: string;
  root_cause: string;
  diagnosis_text_grading: DiagnosisTextGrading;
}

export interface Scenario {
  scenario_id: string;
  expected_answer: ExpectedAnswer;
}

export interface AgentOutput {
  output_id: string;
  scenario_id: string;
  verdict: string;
  root_cause: string;
  diagnosis_text: string;
}

export interface GradeFields {
  verdict: boolean;
  root_cause: boolean;
  criterion_1: boolean;
  criterion_2: boolean;
}

// Q7 — per-criterion judge record: the binary label (graded) plus supplementary
// reasoning (captured for audit, never read by grading logic).
export interface JudgeRecord {
  answer: "yes" | "no";
  reasoning: string;
}

// The single structured result. Both the console printout and
// VALIDATION-NOTES.md §1–2 derive from this object (Q1 — no transcription).
export interface GradeResult {
  outputId: string;
  scenarioId: string;
  fields: GradeFields;
  judgeRaw: { criterion_1: JudgeRecord; criterion_2: JudgeRecord };
  overall: "PASS" | "FAIL";
}
