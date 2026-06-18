import type { Submission } from "./store";
import type { DiagnosisOutput } from "./schema";

// The verdict to show for a submission = its most recent agent turn (multi-turn
// refuse loops end on the resolving turn). null while still diagnosing.
export function lastAgentOutput(sub: Submission): DiagnosisOutput | null {
  for (let i = sub.turns.length - 1; i >= 0; i--) {
    const t = sub.turns[i];
    if (t.role === "agent") return t.output;
  }
  return null;
}

// The original request text (first user turn) — the ticket's headline.
export function firstUserText(sub: Submission): string {
  const t = sub.turns.find((t) => t.role === "user");
  return t && t.role === "user" ? t.text : "";
}
