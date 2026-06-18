import type { Requester } from "@/lib/store";

// Requester identity (SID-63 pillar 2). A real ticket system always shows WHO
// filed it — promoted from a buried trace line to a primary signal. Neutral
// initials avatar (no team colors — color meaning stays reserved for verdicts).

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function RequesterIdentity({
  requester,
  compact = false,
}: {
  requester: Requester;
  compact?: boolean;
}) {
  const avatar = compact ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-sm";
  return (
    <div className="flex min-w-0 items-center gap-sm">
      <span
        aria-hidden
        className={`inline-flex ${avatar} shrink-0 items-center justify-center rounded-full bg-background-secondary font-bold text-text-secondary`}
      >
        {initials(requester.name)}
      </span>
      {compact ? (
        <span className="truncate text-text-primary">{requester.name}</span>
      ) : (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-text-primary">{requester.name}</span>
          <span className="truncate text-sm text-text-muted">
            {requester.role} · {requester.team}
          </span>
        </div>
      )}
    </div>
  );
}
