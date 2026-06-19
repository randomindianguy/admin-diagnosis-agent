import type { DiagnosisOutput } from "./schema";

// Maps a committed verdict to the team channel whose recent activity is worth
// surfacing as operational CONTEXT in the admin trace (SID-65). Pure logic, no
// I/O — safe on the client. Only routing verdicts have a channel:
//   escalate            → the owning team's channel (when it's a real team)
//   resource_owner_routing → the resource owner's channel
// Everything else returns null (no context block).
//
// This never feeds the model or the verdict. It only chooses which channel the
// display layer reads from after the fact.

const TEAM_CHANNELS = new Set(["identity-team", "security-team", "support-team"]);

function slugifyOwner(owner: string): string {
  return owner
    .toLowerCase()
    .replace(/^the\s+/, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Post-verdict notification target (SID-66). DELIBERATELY narrower than
// routingChannelFor: only an `escalate` to a real team channel posts. Owner-
// routing resolves return a channel for the SID-65 display layer but must NOT
// trigger a Slack post (different framing — a follow-up card). resource-owner /
// human-reviewer escalates have no team channel → null → skip silently.
export function escalationChannelFor(output: DiagnosisOutput): string | null {
  if (output.verdict !== "escalate") return null;
  return TEAM_CHANNELS.has(output.owner) ? output.owner : null;
}

export function routingChannelFor(output: DiagnosisOutput): string | null {
  if (output.verdict === "escalate") {
    return TEAM_CHANNELS.has(output.owner) ? output.owner : null;
  }
  if (
    output.verdict === "resolve" &&
    output.root_cause === "resource_owner_routing"
  ) {
    const owned = output.status_facts.resources.find((r) => r.owner);
    return owned?.owner ? slugifyOwner(owned.owner) : null;
  }
  return null;
}
