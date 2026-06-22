"use client";

import { Check, Info } from "lucide-react";
import type { DiagnosisOutput } from "@/lib/schema";
import { RESOURCE_URLS } from "@/lib/resource-urls";
import { OutcomeCard } from "./outcome-card";

// SID-75: the approval PAYOFF as its own card. The escalate "Submitted" card no
// longer mutates in place — it stays the frozen submit-moment; this renders the
// terminal admin decision (approved / denied) as a distinct LATER moment below a
// ThreadDivider. Same end-user register as EndUserCard (pill → headline → body →
// quiet links). Only add_to_group escalates reach a terminal in-app decision;
// team_routing is out-of-band, so this returns null for it.
export function ApprovalResultCard({
  output,
  status,
}: {
  output: DiagnosisOutput;
  status: "approved" | "denied";
}) {
  if (
    output.verdict !== "escalate" ||
    output.approval_action?.type !== "add_to_group"
  ) {
    return null;
  }
  const aa = output.approval_action;
  const linkCls = "text-accent underline-offset-2 hover:underline";
  const slack = aa.slack_permalink;

  if (status === "denied") {
    return (
      <OutcomeCard>
        <div className="flex flex-col gap-md motion-safe:animate-[fadeIn_250ms_ease-out]">
          <div>
            <span className="inline-flex items-center gap-xs rounded-sm border border-border bg-background-primary px-md py-xs text-text-secondary">
              <Info size={16} aria-hidden />
              Not approved
            </span>
          </div>
          <h2 className="font-display text-[22px] font-medium leading-heading tracking-display text-text-primary [text-wrap:balance]">
            Your request wasn&rsquo;t approved.
          </h2>
          <p className="text-text-secondary [text-wrap:pretty]">
            Your admin reviewed this and didn&rsquo;t grant access. If you still
            need it, follow up with them directly.
          </p>
          {slack && (
            <p className="text-sm text-text-muted">
              Routing record ·{" "}
              <a href={slack} target="_blank" rel="noopener noreferrer" className={linkCls}>
                View in Slack →
              </a>
            </p>
          )}
        </div>
      </OutcomeCard>
    );
  }

  // approved — the access is live. Resolve-toned pill, the resource link as the
  // primary CTA, the Slack routing record as the quiet provenance line.
  const resourceName = output.status_facts.resources.find((r) =>
    r.grants.some((g) => g.principal === aa.group_id),
  )?.name;
  const url = resourceName ? RESOURCE_URLS[resourceName] : "";
  return (
    <OutcomeCard>
      <div className="flex flex-col gap-md motion-safe:animate-[fadeIn_250ms_ease-out]">
        <div>
          <span className="inline-flex items-center gap-xs rounded-sm border border-verdict-resolve/40 bg-verdict-resolve/10 px-md py-xs text-verdict-resolve">
            <Check size={16} aria-hidden />
            Resolved
          </span>
        </div>
        <h2 className="font-display text-[22px] font-medium leading-heading tracking-display text-text-primary [text-wrap:balance]">
          You&rsquo;re all set.
        </h2>
        <p className="text-text-secondary [text-wrap:pretty]">
          Your admin approved access
          {resourceName ? ` to ${resourceName}` : ""}. You&rsquo;re good to go.
        </p>
        <div className="flex flex-col gap-xs">
          {url && (
            <p className="text-sm text-text-muted">
              <a href={url} target="_blank" rel="noopener noreferrer" className={linkCls}>
                Open in Notion →
              </a>
            </p>
          )}
          {slack && (
            <p className="text-sm text-text-muted">
              Routing record ·{" "}
              <a href={slack} target="_blank" rel="noopener noreferrer" className={linkCls}>
                View in Slack →
              </a>
            </p>
          )}
        </div>
      </div>
    </OutcomeCard>
  );
}
