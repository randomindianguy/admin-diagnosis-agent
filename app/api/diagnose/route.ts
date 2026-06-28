import { NextResponse, after } from "next/server";
import { retrieveContext } from "@/lib/retrieval";
import { runGatedDiagnosis } from "@/lib/gate-signals";
import { notifyRoutingChannel } from "@/lib/notify";
import { logQuery } from "@/lib/query-log";

// Retrieval reads the filesystem (reference-library/, scenario.json), so this
// route runs on the Node.js runtime, not edge.
export const runtime = "nodejs";

// POST /api/diagnose  —  body: { symptom: string }  →  DiagnosisOutput (Q4)
//
// Error contract (Q16): errors are a SEPARATE channel from DiagnosisOutput — a
// crash is never dressed up as an escalate (chunk-1 fail-loud, one altitude up).
//   400 → invalid input  |  500 → upstream/internal failure  |  200 → output
export async function POST(request: Request): Promise<Response> {
  // --- 400 guards, BEFORE the pipeline try/catch, so bad input can never be
  //     swallowed into the upstream-failure 500 path. ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const symptom = (body as { symptom?: unknown }).symptom;
  if (typeof symptom !== "string" || symptom.trim().length === 0) {
    return NextResponse.json(
      { error: "Field 'symptom' is required and must be a non-empty string." },
      { status: 400 },
    );
  }

  // SID-70: optional persona identity — the backend reasons against this user's
  // real Okta identity instead of scenario.json's fixed current_user.
  const rawPersona = (body as { personaUserId?: unknown }).personaUserId;
  const personaUserId =
    typeof rawPersona === "string" && rawPersona.length > 0
      ? rawPersona
      : undefined;

  // SID-80: the client-side submission id, threaded through so logged rows group
  // by ticket (mirrors personaUserId above). Falls back to "unknown" so the NOT
  // NULL column always has a value even if an old client omits it.
  const rawTicketId = (body as { ticketId?: unknown }).ticketId;
  const ticketId =
    typeof rawTicketId === "string" && rawTicketId.length > 0
      ? rawTicketId
      : "unknown";

  // --- Pipeline. The try wraps ONLY retrieve → gate, so its catch returns 500
  //     exclusively for upstream/internal failure — not for client input. ---
  try {
    const context = await retrieveContext(symptom, personaUserId);
    const output = await runGatedDiagnosis(symptom, context);
    // Post-verdict side effect (SID-66): announce an escalate to its routing channel
    // AFTER the verdict commits. Bounded to 2s and never throws, so it can't alter or
    // fail the response — the verdict above is already final. Capture the message
    // permalink and attach it to the approval_action so the end-user "view in Slack"
    // link can deep-link to the thread. SID-73: every escalate posts a routing record
    // (both add_to_group and team_routing), so the permalink attaches to either member.
    const permalink = await notifyRoutingChannel(output);
    if (
      permalink &&
      output.verdict === "escalate" &&
      output.approval_action
    ) {
      output.approval_action.slack_permalink = permalink;
    }
    // SID-80: persist the user's query for offline comparison against the eval set.
    // STORAGE ONLY (no read path in the app). Runs via after() so the insert happens
    // AFTER the response is flushed — zero added latency, and unlike a bare un-awaited
    // promise it isn't dropped when the serverless function freezes. logQuery never
    // throws, so a logging outage can't affect this already-final response.
    after(
      logQuery({ ticket_id: ticketId, message: symptom, verdict: output.verdict }),
    );
    return NextResponse.json(output, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown diagnosis error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
