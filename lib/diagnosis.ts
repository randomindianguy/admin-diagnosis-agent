// Diagnosis — Q2/Q11: structured output via Anthropic tool-use.
//
// Two tools (resolve, escalate); tool_choice "any" forces exactly one. The
// verdict IS which tool fired. Each tool's schema enforces its required fields,
// and root_cause is a closed enum — the model cannot invent a label, so when
// nothing matches its only escape is to escalate (Q4 authoring rule, enforced
// structurally). The tool emits ONLY judgment fields; the system populates the
// fact fields (retrieved_evidence, gate_signals) when it assembles the full
// DiagnosisOutput (Q11 judgment/fact split).
//
// Model: claude-sonnet-4-6 — consistent with chunk 1's judge, and it accepts
// `temperature`, which the step-7 consistency gate needs for real N-sample
// variation (Opus 4.x / Fable reject the param). Content-shaped choice, not a
// Q-number.

import Anthropic from "@anthropic-ai/sdk";
import { CANONICAL_ROOT_CAUSES } from "./canonical-labels";
import type { CanonicalRootCause } from "./canonical-labels";
import { CANONICAL_ESCALATION_OWNERS } from "./escalation";
import type { CanonicalEscalationOwner } from "./escalation";
import type { RetrievalResult, StatusFacts } from "./retrieval";

const DIAGNOSIS_MODEL = "claude-sonnet-4-6";

// The model's output — the judgment half of DiagnosisOutput. The route/gate
// merge this with the code-owned fact fields to build the full contract object.
// Q18: owner narrows from open string to the canonical model-facing enum;
// FALLBACK_ESCALATION_OWNER ("human-reviewer") is a system-only value that
// appears in the assembled DiagnosisOutput, not here — the model never picks it.
export type DiagnosisJudgment =
  | { verdict: "resolve"; root_cause: CanonicalRootCause; diagnosis_text: string }
  | { verdict: "escalate"; owner: CanonicalEscalationOwner; diagnosis_text: string };

// --- The approved tool-schema contract (Q11) ---------------------------------

const RESOLVE_TOOL: Anthropic.Tool = {
  name: "resolve",
  description:
    "Submit a resolution when the evidence clearly supports one of the known canonical root causes. " +
    "Use this ONLY when a canonical mechanism plainly matches. If no canonical root_cause fits, do not " +
    "use this tool — use `escalate` instead.",
  input_schema: {
    type: "object",
    properties: {
      root_cause: {
        type: "string",
        enum: [...CANONICAL_ROOT_CAUSES],
        description:
          "The canonical mechanism behind the issue. Must be exactly one of the enumerated labels — never invent a new one.",
      },
      diagnosis_text: {
        type: "string",
        description:
          "Plain-language explanation of the root cause. Name the specific entities involved (users, groups, resources) and explicitly correct any mistaken claim in the operator's message.",
      },
    },
    required: ["root_cause", "diagnosis_text"],
    additionalProperties: false,
  },
};

const ESCALATE_TOOL: Anthropic.Tool = {
  name: "escalate",
  description:
    "Escalate when no canonical root_cause matches the evidence, or when the evidence is insufficient to " +
    "diagnose confidently. Routes the issue to one of the canonical authority classes.",
  input_schema: {
    type: "object",
    properties: {
      owner: {
        type: "string",
        enum: [...CANONICAL_ESCALATION_OWNERS],
        description:
          "The canonical authority class to route the issue to. Must be exactly one of the enumerated owners — " +
          "never invent a new one. Use `support-team` as the within-enum catchment when no specialist class clearly fits.",
      },
      diagnosis_text: {
        type: "string",
        description: "Plain-language explanation of why this is being escalated rather than resolved.",
      },
    },
    required: ["owner", "diagnosis_text"],
    additionalProperties: false,
  },
};

// --- System prompt (content — post-write review) -----------------------------

const SYSTEM_PROMPT = [
  "You are an access-diagnosis assistant for a workspace admin console. You diagnose why a user can or",
  "cannot access a resource — group inheritance, permission grants, membership issues.",
  "",
  "You are given an operator's message, the current status picture (the ground truth about users, groups,",
  "and resources), and the most relevant runbook page. Diagnose strictly from these facts. Do not invent",
  "memberships, grants, or group relationships that are not in the status picture.",
  "",
  "Decide between two actions:",
  "- Call `resolve` when the status picture and runbook clearly point to one canonical root cause.",
  "- Call `escalate` when no canonical root cause matches, or the evidence is insufficient to be confident.",
  "",
  "When you resolve, the diagnosis_text must name the specific entities involved and, if the operator's",
  "message contains a mistaken claim (e.g. about which group the user is in), correct it explicitly by",
  "naming both what they checked and what is actually true. Write in plain language for a busy operator.",
  "",
  "Write diagnosis_text as plain prose — complete sentences in short paragraphs. Do NOT use any markdown",
  "formatting: no asterisks for bold or emphasis, no # headers, no bullet or numbered lists.",
].join("\n");

// --- Retrieval formatting (content — post-write review) -----------------------

function formatStatusFacts(status: StatusFacts): string {
  if (
    status.users.length === 0 &&
    status.groups.length === 0 &&
    status.resources.length === 0
  ) {
    return "(no matching users, groups, or resources found in the status picture)";
  }
  // Resolve internal IDs to plain names so nothing ID-flavored reaches the prompt
  // — diagnosis_text is operator-facing (V4 right pane + criterion-2 judge), and
  // internal IDs leaking into user-facing prose is a polish gap. Fall back to the
  // raw id only if a referenced group isn't in the retrieved set.
  const nameOf = new Map<string, string>();
  for (const g of status.groups) nameOf.set(g.id, g.name);
  const name = (id: string): string => nameOf.get(id) ?? id;

  const lines: string[] = [];
  for (const u of status.users) {
    const memberships =
      u.direct_group_memberships.map(name).join(", ") || "(none)";
    lines.push(`- User "${u.name}" is a DIRECT member of: ${memberships}`);
  }
  for (const g of status.groups) {
    lines.push(
      `- Group "${g.name}"${g.parent ? `, nested under "${name(g.parent)}"` : " (top-level)"}`,
    );
  }
  for (const r of status.resources) {
    const grants = r.grants
      .map((grant) => `"${name(grant.principal)}" = ${grant.level}`)
      .join("; ");
    lines.push(`- Resource "${r.name}" grants: ${grants || "(none)"}`);
  }
  return lines.join("\n");
}

function formatRunbook(runbook: RetrievalResult["runbook"]): string {
  if (runbook.length === 0) return "(no runbook pages retrieved)";
  return runbook
    .map((e) => `Source: ${e.source}\n${e.snippet}`)
    .join("\n\n---\n\n");
}

function buildUserPrompt(symptom: string, context: RetrievalResult): string {
  return [
    "OPERATOR MESSAGE:",
    symptom,
    "",
    "CURRENT STATUS PICTURE (ground truth):",
    formatStatusFacts(context.status),
    "",
    "RELEVANT RUNBOOK:",
    formatRunbook(context.runbook),
  ].join("\n");
}

// --- Strict parse of the tool call (fail loud — chunk-1 Q3 discipline) --------

function isCanonical(value: unknown): value is CanonicalRootCause {
  return (
    typeof value === "string" &&
    (CANONICAL_ROOT_CAUSES as readonly string[]).includes(value)
  );
}

function isCanonicalOwner(value: unknown): value is CanonicalEscalationOwner {
  return (
    typeof value === "string" &&
    (CANONICAL_ESCALATION_OWNERS as readonly string[]).includes(value)
  );
}

function parseToolCall(
  name: string,
  input: unknown,
): DiagnosisJudgment {
  const obj = (input ?? {}) as Record<string, unknown>;
  if (name === "resolve") {
    if (!isCanonical(obj.root_cause)) {
      throw new Error(
        `resolve tool returned a non-canonical root_cause: ${JSON.stringify(obj.root_cause)}`,
      );
    }
    if (typeof obj.diagnosis_text !== "string" || obj.diagnosis_text.length === 0) {
      throw new Error("resolve tool returned an empty diagnosis_text.");
    }
    return {
      verdict: "resolve",
      root_cause: obj.root_cause,
      diagnosis_text: obj.diagnosis_text,
    };
  }
  if (name === "escalate") {
    if (!isCanonicalOwner(obj.owner)) {
      throw new Error(
        `escalate tool returned a non-canonical owner: ${JSON.stringify(obj.owner)}`,
      );
    }
    if (typeof obj.diagnosis_text !== "string" || obj.diagnosis_text.length === 0) {
      throw new Error("escalate tool returned an empty diagnosis_text.");
    }
    return { verdict: "escalate", owner: obj.owner, diagnosis_text: obj.diagnosis_text };
  }
  throw new Error(`Model called an unexpected tool: ${JSON.stringify(name)}`);
}

// --- The diagnosis call ------------------------------------------------------

export async function diagnose(
  symptom: string,
  context: RetrievalResult,
  options: { temperature?: number } = {},
): Promise<DiagnosisJudgment> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: DIAGNOSIS_MODEL,
    max_tokens: 1024,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    system: SYSTEM_PROMPT,
    tools: [RESOLVE_TOOL, ESCALATE_TOOL],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: buildUserPrompt(symptom, context) }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `Diagnosis model did not return a tool call (stop_reason=${response.stop_reason}).`,
    );
  }
  return parseToolCall(toolUse.name, toolUse.input);
}
