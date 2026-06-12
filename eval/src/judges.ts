import Anthropic from "@anthropic-ai/sdk";

// Q6 — recent mid-tier Sonnet; no temperature / no thinking (set at the call site).
// Cross-validated once against claude-opus-4-8 (Addition 1) — full agreement on all four calls.
export const JUDGE_MODEL = "claude-sonnet-4-6";

export interface JudgeCriterion {
  key: string;
  prompt: string;
}

// Q5 — per-scenario registry keyed by scenario_id. Prompt wording is
// seed-specific, so it lives here; scenario.json stays source of truth for
// WHICH criteria apply and the pass rule.
const JUDGE_REGISTRY: Record<string, JudgeCriterion[]> = {
  "seed-1": [
    {
      key: "mechanism_identification",
      prompt:
        "Does the diagnosis identify that the user's actual group membership is in a nested subgroup that does not inherit access from the parent group? Answer yes or no.",
    },
    {
      key: "operator_reconciliation",
      prompt:
        "Does the diagnosis explicitly correct the operator's claim that they checked the user's group membership correctly — by naming both the group the operator checked AND the actual subgroup the user is a direct member of? Answer yes or no.",
    },
  ],
};

const JUDGE_SYSTEM_PROMPT =
  "You are a strict binary grader. You are given a support agent's diagnosis and one yes/no criterion. " +
  "Decide only whether the diagnosis CLEARLY AND SPECIFICALLY meets the criterion. " +
  "Vague, partial, or merely implied fulfillment is 'no'. " +
  "Answer 'yes' or 'no' on the first line. Then on a new line, briefly state your reasoning " +
  "(1–2 sentences) — what specifically in the diagnosis met or failed to meet the criterion.";

// Q5 — fail loud on a missing scenario, and enforce the drift guard:
// the registry's criterion keys must match the scenario's declared keys.
export function getJudgeCriteria(
  scenarioId: string,
  declaredKeys: string[],
): JudgeCriterion[] {
  const criteria = JUDGE_REGISTRY[scenarioId];
  if (!criteria) {
    throw new Error(
      `No judge prompts registered for scenario '${scenarioId}'. Add an entry to JUDGE_REGISTRY in judges.ts.`,
    );
  }
  const registered = criteria.map((c) => c.key).sort();
  const declared = [...declaredKeys].sort();
  const drift =
    registered.length !== declared.length ||
    registered.some((k, i) => k !== declared[i]);
  if (drift) {
    throw new Error(
      `Judge registry drift for scenario '${scenarioId}': scenario declares [${declaredKeys.join(", ")}] ` +
        `but registry has [${criteria.map((c) => c.key).join(", ")}]. Reconcile judges.ts with scenario.json.`,
    );
  }
  return criteria;
}

// Q3 — strict parse of the LABEL is unchanged: the first line must normalize to
// yes/no, else fail loud. Q7 — remaining lines are captured as supplementary
// reasoning (audit-only; never graded).
function parseJudgeResponse(raw: string): { answer: "yes" | "no"; reasoning: string } {
  const lines = raw.split("\n");
  const label = (lines[0] ?? "").trim().toLowerCase().replace(/\.+$/, "");
  const reasoning = lines.slice(1).join("\n").trim();
  if (label === "yes") return { answer: "yes", reasoning };
  if (label === "no") return { answer: "no", reasoning };
  throw new Error(
    `Judge first line was not 'yes' or 'no' (got ${JSON.stringify(lines[0] ?? "")}). Full response: ${JSON.stringify(raw)}`,
  );
}

export interface JudgeOutcome {
  pass: boolean;
  answer: "yes" | "no";
  reasoning: string;
}

// Q2 — one API call per criterion.
export async function runJudge(
  client: Anthropic,
  criterionPrompt: string,
  diagnosisText: string,
): Promise<JudgeOutcome> {
  const response = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 200,
    system: JUDGE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Criterion: ${criterionPrompt}\n\nDiagnosis:\n${diagnosisText}\n\nAnswer yes or no, then your reasoning.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(
      `Judge returned no text block (stop_reason=${response.stop_reason}).`,
    );
  }
  const { answer, reasoning } = parseJudgeResponse(textBlock.text);
  return { pass: answer === "yes", answer, reasoning };
}
