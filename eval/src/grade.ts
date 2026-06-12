import Anthropic from "@anthropic-ai/sdk";
import type { AgentOutput, GradeResult, Scenario } from "./types";
import { getJudgeCriteria, runJudge } from "./judges";

// The ruler. Grades one output against one scenario and returns a GradeResult.
// Exact-match on what has a single right answer; binary LLM-judge on what doesn't.
// No assertion here — this returns facts; validate.ts decides done-criterion.
export async function gradeOutput(
  client: Anthropic,
  scenario: Scenario,
  output: AgentOutput,
): Promise<GradeResult> {
  const expected = scenario.expected_answer;
  const grading = expected.diagnosis_text_grading;

  // Code-based exact match.
  const verdictPass = output.verdict === expected.verdict;
  const rootCausePass = output.root_cause === expected.root_cause;

  // Implement exactly one pass rule (Q5), driven by the scenario field; fail loud otherwise.
  if (grading.pass_rule !== "all_must_pass") {
    throw new Error(
      `Unsupported pass_rule '${grading.pass_rule}' for scenario '${scenario.scenario_id}'. Only 'all_must_pass' is implemented.`,
    );
  }

  // Resolve judge prompts with the drift guard, then enforce the seed-1 shape.
  const criteria = getJudgeCriteria(scenario.scenario_id, grading.criteria);
  if (criteria.length !== 2) {
    throw new Error(
      `This ruler emits criterion_1/criterion_2; scenario '${scenario.scenario_id}' declares ${criteria.length} criteria. Extend the result shape before adding such a seed.`,
    );
  }

  // One judge call per criterion (Q2), in declared order.
  const c1 = await runJudge(client, criteria[0].prompt, output.diagnosis_text);
  const c2 = await runJudge(client, criteria[1].prompt, output.diagnosis_text);

  const fields = {
    verdict: verdictPass,
    root_cause: rootCausePass,
    criterion_1: c1.pass,
    criterion_2: c2.pass,
  };

  // diagnosis_text passes iff both criteria pass (flat AND); overall PASS iff every field passes.
  const overall =
    fields.verdict && fields.root_cause && fields.criterion_1 && fields.criterion_2
      ? "PASS"
      : "FAIL";

  return {
    outputId: output.output_id,
    scenarioId: scenario.scenario_id,
    fields,
    judgeRaw: {
      criterion_1: { answer: c1.answer, reasoning: c1.reasoning },
      criterion_2: { answer: c2.answer, reasoning: c2.reasoning },
    },
    overall,
  };
}
