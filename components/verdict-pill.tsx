import type { DiagnosisOutput } from "@/lib/schema";

// Verdict treatment (SID-67). Two registers for one meaning:
//   VerdictText — the PRIMARY moment. Verdict as content, not a label: display
//     serif, colored, no pill. Used on the admin escalation package + end-user.
//   VerdictPill — the SCAN badge. A thin warm pill (1px border + subtle fill, NOT
//     solid, 4px corners) kept for at-a-glance scanning in the admin feed and the
//     ticket-detail header. Both read from the same verdictVisual() source.

type Tone = "resolve" | "escalate" | "refuse";

const TONE: Record<Tone, { text: string; pill: string }> = {
  resolve: {
    text: "text-verdict-resolve",
    pill: "border-verdict-resolve/40 bg-verdict-resolve/10 text-verdict-resolve",
  },
  escalate: {
    text: "text-verdict-escalate",
    pill: "border-verdict-escalate/40 bg-verdict-escalate/10 text-verdict-escalate",
  },
  refuse: {
    text: "text-verdict-refuse",
    pill: "border-verdict-refuse/50 bg-verdict-refuse/10 text-verdict-refuse",
  },
};

const OWNER: Record<string, string> = {
  "identity-team": "Identity team",
  "security-team": "Security team",
  "support-team": "Support team",
  "resource-owner": "resource owner",
  "human-reviewer": "human reviewer",
};

function humanize(label: string): string {
  const s = label.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// word = the verdict; detail = the qualifier (root cause / owner / scope). The
// word carries the color; the detail recedes to muted so it reads as a caption.
function verdictVisual(output: DiagnosisOutput): {
  tone: Tone;
  word: string;
  detail?: string;
} {
  if (output.verdict === "resolve")
    return { tone: "resolve", word: "Resolved", detail: humanize(output.root_cause) };
  if (output.verdict === "escalate")
    return {
      tone: "escalate",
      word: "Escalated",
      detail: OWNER[output.owner] ?? output.owner,
    };
  if (output.refuse_reason === "out_of_scope")
    return { tone: "refuse", word: "Refused", detail: "out of scope" };
  return { tone: "refuse", word: "Needs detail" };
}

// PRIMARY verdict moment — display serif, colored. Size is overridable so the
// admin package and the end-user can pitch it differently.
export function VerdictText({
  output,
  className = "text-displayLg",
}: {
  output: DiagnosisOutput;
  className?: string;
}) {
  const v = verdictVisual(output);
  return (
    <p
      className={`font-display font-medium leading-heading tracking-display ${TONE[v.tone].text} ${className}`}
    >
      {v.word}
      {v.detail && (
        <span className="text-text-muted"> · {v.detail}</span>
      )}
    </p>
  );
}

// SCAN badge — thin warm pill for the feed + detail header.
export function VerdictPill({ output }: { output: DiagnosisOutput }) {
  const v = verdictVisual(output);
  return (
    <span
      className={`inline-flex w-fit items-center rounded-sm border px-sm py-[2px] text-sm ${TONE[v.tone].pill}`}
    >
      {v.word}
    </span>
  );
}
