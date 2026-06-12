import type { DiagnosisOutput } from "@/lib/schema";

// Slim summary of the most recent prior query + its verdict (UI-SPEC component 3).
// Persists across submits so the operator can compare "did rephrasing change
// anything." Replaced (not appended) on next submit; absent on first load.
interface PreviousVerdictRowProps {
  query: string;
  verdict: DiagnosisOutput["verdict"];
}

export function PreviousVerdictRow({ query, verdict }: PreviousVerdictRowProps) {
  return (
    <div className="flex items-center gap-md rounded-md bg-background-secondary px-md py-sm text-body text-text-secondary">
      <span className="shrink-0 text-text-muted">Previous</span>
      <span className="truncate">{query}</span>
      <span className="ml-auto shrink-0 text-text-primary">
        {verdict === "resolve" ? "Resolved" : "Escalated"}
      </span>
    </div>
  );
}
