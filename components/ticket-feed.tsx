import type { Submission } from "@/lib/store";
import { TicketCard } from "./ticket-card";

// The admin feed (SID-63) — newest-first list of tickets. Range at a glance: a
// demo viewer sees the agent's span of verdicts without driving the demo.
export function TicketFeed({
  submissions,
  selectedId,
  now,
  onSelect,
}: {
  submissions: Submission[];
  selectedId: string | null;
  now: number;
  onSelect: (id: string) => void;
}) {
  const sorted = [...submissions].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="flex flex-col gap-sm">
      {sorted.map((s) => (
        <TicketCard
          key={s.id}
          submission={s}
          selected={s.id === selectedId}
          now={now}
          onSelect={() => onSelect(s.id)}
        />
      ))}
    </div>
  );
}
