"use client";

import type { Submission } from "@/lib/store";
import type { DiagnosisOutput } from "@/lib/schema";
import { RequesterIdentity } from "./requester-identity";
import { VerdictPill } from "./verdict-pill";
import { UserBubble } from "./user-bubble";
import { ReasoningTrace } from "./reasoning-trace";
import { DiagnosisOutput as DiagnosisOutputCard } from "./diagnosis-output";
import { RefusalOutput } from "./refusal-output";
import { ErrorState } from "./error-state";
import { timeAgo } from "@/lib/relative-time";
import { lastAgentOutput } from "@/lib/submission";

// Live state for the ONE in-flight ticket (the just-submitted one being
// diagnosed). When present, the trace animates (SID-59) and the package gates on
// the trace settling — same machinery as the old admin two-pane, now driven by
// the store's selected ticket.
export type LiveTrace = {
  output: DiagnosisOutput | null; // diagnose.data while in flight
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  revealedRowCount: number;
  swappedRowCount: number;
  onSettled: () => void;
  packageReady: boolean; // traceSettled — un-gate the package
};

export function TicketDetail({
  submission,
  now,
  live,
}: {
  submission: Submission;
  now: number;
  live?: LiveTrace;
}) {
  const isLive = !!live;
  const output = isLive ? (live?.output ?? null) : lastAgentOutput(submission);

  // The final agent turn becomes the trace + package below; everything else
  // (the request + any clarifying refuse exchange) is the thread above.
  const turns = submission.turns;
  let lastAgentIdx = -1;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === "agent") {
      lastAgentIdx = i;
      break;
    }
  }
  const threadTurns = turns.filter((_, i) => i !== lastAgentIdx);

  const isAmbiguityRefuse =
    output?.verdict === "refuse_out_of_scope" &&
    output.refuse_reason !== "out_of_scope";

  const packageReady = isLive ? !!live?.packageReady : true;

  return (
    <div className="flex flex-col gap-lg">
      {/* Requester identity — promoted to a primary signal (SID-63 pillar 2). */}
      <div className="flex items-start justify-between gap-md">
        <RequesterIdentity requester={submission.requester} />
        <div className="flex shrink-0 items-center gap-sm">
          {output && <VerdictPill output={output} />}
          <span className="text-sm text-text-muted">
            {timeAgo(submission.createdAt, now)}
          </span>
        </div>
      </div>

      {/* Thread — the request and any clarify-loop exchange. */}
      <div className="flex flex-col gap-md">
        {threadTurns.map((t) =>
          t.role === "user" ? (
            <UserBubble key={t.id} text={t.text} />
          ) : (
            <p
              key={t.id}
              className="text-sm text-text-secondary"
            >
              Agent asked:{" "}
              {t.output.verdict === "refuse_out_of_scope"
                ? (t.output.missing_info ?? "for more detail")
                : "for more detail"}
            </p>
          ),
        )}
      </div>

      {/* Escalation package. aria-live ONLY for the in-flight ticket (SID-63
          harden) so a screen reader announces Diagnosing → verdict; settled
          tickets are static and need no live region. */}
      <div
        aria-live={isLive ? "polite" : undefined}
        className="flex flex-col gap-lg"
      >
      {live?.isError ? (
        <ErrorState
          message={live.errorMessage ?? "Something went wrong."}
          onRetry={live.onRetry ?? (() => {})}
        />
      ) : isAmbiguityRefuse && output ? (
        // Ambiguity refuse — no escalation package; the agent asked the user to
        // clarify (SID-56 Phase 2, Option A).
        <RefusalOutput output={output} />
      ) : (
        <>
          <ReasoningTrace
            output={output}
            revealedRowCount={live?.revealedRowCount ?? 0}
            swappedRowCount={live?.swappedRowCount ?? 0}
            onSettled={live?.onSettled}
            settled={!isLive}
          />
          {packageReady && output && (
            <div className="flex flex-col gap-md motion-safe:animate-[fadeIn_250ms_ease-out]">
              <p className="text-sm text-text-muted">
                Escalation package — the full investigation an admin receives.
              </p>
              {output.verdict === "refuse_out_of_scope" ? (
                <RefusalOutput output={output} />
              ) : (
                <DiagnosisOutputCard output={output} />
              )}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
