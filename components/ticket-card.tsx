import type { Submission } from "@/lib/store";
import { RequesterIdentity } from "./requester-identity";
import { VerdictPill } from "./verdict-pill";
import { timeAgo } from "@/lib/relative-time";
import { lastAgentOutput, firstUserText } from "@/lib/submission";

// One ticket in the admin feed (SID-63). Shows WHO (requester), WHAT (the
// request), and the OUTCOME (verdict pill) — final verdict only; the full thread
// lives in the detail. Unseen tickets carry a neutral dot.
export function TicketCard({
  submission,
  selected,
  now,
  onSelect,
}: {
  submission: Submission;
  selected: boolean;
  now: number;
  onSelect: () => void;
}) {
  const output = lastAgentOutput(submission);
  const request = firstUserText(submission);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`flex w-full flex-col gap-sm rounded-md border px-md py-sm text-left transition-colors ${
        selected
          ? "border-brand-primary bg-background-secondary"
          : "border-border hover:border-text-muted"
      }`}
    >
      <div className="flex items-center justify-between gap-sm">
        <RequesterIdentity requester={submission.requester} compact />
        <div className="flex shrink-0 items-center gap-sm">
          {!submission.seen && (
            <span
              className="h-2 w-2 rounded-full bg-text-primary"
              aria-label="Unseen"
            />
          )}
          <span className="text-sm text-text-muted">
            {timeAgo(submission.createdAt, now)}
          </span>
        </div>
      </div>
      <p className="line-clamp-2 text-text-secondary">{request}</p>
      {output ? (
        <VerdictPill output={output} />
      ) : (
        <span className="text-sm text-text-muted">Diagnosing…</span>
      )}
    </button>
  );
}
