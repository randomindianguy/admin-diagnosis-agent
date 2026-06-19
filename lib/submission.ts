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

// SID-69: the FINAL verdict for a submission, accounting for an end-user
// continuation. If a "needs detail" refuse was clarified + resolved
// (follow_up_turns), the final state is the continuation's last agent turn;
// otherwise it's the same as lastAgentOutput. The admin path keeps using
// lastAgentOutput (turns only), so the admin feed pill stays byte-identical.
export function finalAgentOutput(sub: Submission): DiagnosisOutput | null {
  const fu = sub.follow_up_turns;
  if (fu) {
    for (let i = fu.length - 1; i >= 0; i--) {
      const t = fu[i];
      if (t.role === "agent") return t.output;
    }
  }
  return lastAgentOutput(sub);
}
