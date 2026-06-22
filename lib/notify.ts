// Post-verdict Slack notification (SID-66). Called by the API route AFTER a
// verdict commits — the orchestration announcing the verdict it already made, not
// new reasoning or a model write. The trust mechanic is unchanged: a human
// reading the Slack message can still ignore a wrong verdict, same as today.
//
// Hard guarantees (load-bearing):
//   - Only TEAM-ROUTED escalates post (SID-70): add_to_group escalates are now
//     handled in-app via the approval flow, so they no longer Slack-post — the
//     action lives where the actor acts. Team-routed escalates stay in Slack mode.
//   - Bounded to 2s and never throws → Slack latency/failure can't fail the
//     diagnosis. The 200 response is byte-identical whether or not the post lands.
//   - Missing/invalid token → no channel resolves → skip silently.
//   - On success it returns the message permalink (SID-70) so the route can put it
//     on approval_action.team_routing for the end-user "view in Slack" link.
//
// Eval never reaches this: it calls diagnose()/retrieveContext directly, not the
// route. So eval stays green by construction.

import type { DiagnosisOutput } from "./schema";
import { escalationChannelFor } from "./operational-context";
import { postNotification } from "./sources/slack";

const NOTIFY_TIMEOUT_MS = 2000;
const TICKET_URL = "https://admin-diagnosis-agent.vercel.app/admin";

// Requester line sourced from the escalation package's identity slice
// (status_facts.users) — name + their team, e.g. "Alex Chen · analytics-team".
// Omitted when the slice carries no user (graceful).
function requesterLine(output: Extract<DiagnosisOutput, { verdict: "escalate" }>):
  | string
  | null {
  const user = output.status_facts.users[0];
  if (!user) return null;
  const teams = user.direct_group_memberships
    .map((g) => g.replace(/^group:/, ""))
    .join(", ");
  return teams ? `${user.name} · ${teams}` : user.name;
}

// Reshape the existing escalation package for chat: header, requester, the
// investigation text as-is, and a link back to the ticket. No re-invention.
function buildMessage(
  output: Extract<DiagnosisOutput, { verdict: "escalate" }>,
): string {
  const requester = requesterLine(output);
  const lines = [
    "🛡️ Triaged: Escalate — routed here from Cleared",
    "",
    ...(requester ? [requester] : []),
    output.diagnosis_text,
    "",
    `Full ticket: ${TICKET_URL}`,
  ];
  return lines.join("\n");
}

// Returns the posted message's Slack permalink on success, else undefined.
export async function notifyRoutingChannel(
  output: DiagnosisOutput,
): Promise<string | undefined> {
  // SID-70: only team-routed escalates post. add_to_group escalates are approved
  // in-app, so they skip Slack entirely.
  if (output.verdict !== "escalate" || output.approval_action?.type !== "team_routing") {
    return undefined;
  }
  const channel = escalationChannelFor(output);
  if (!channel) return undefined; // no real team channel → no post
  const text = buildMessage(output);
  try {
    const result = await Promise.race([
      postNotification(channel, text),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Slack notify timeout (${NOTIFY_TIMEOUT_MS}ms)`)),
          NOTIFY_TIMEOUT_MS,
        ),
      ),
    ]);
    if (!result.ok) {
      console.warn(`[notify] Slack post to #${channel} skipped (no token / unknown channel / rejected).`);
      return undefined;
    }
    console.info(`[notify] Posted escalate verdict to #${channel}.`);
    return result.permalink;
  } catch (err) {
    // Timeout or unexpected throw — log and continue. The verdict already stands.
    console.warn(
      `[notify] Slack post to #${channel} failed:`,
      err instanceof Error ? err.message : err,
    );
    return undefined;
  }
}
