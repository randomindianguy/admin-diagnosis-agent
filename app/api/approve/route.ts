import { NextResponse } from "next/server";
import { addUserToGroup } from "@/lib/sources/okta";

// POST /api/approve — the closed-loop write (SID-70). Body: { user_id, group_id }
// (re-keyed "user:<login>" / "group:<name>" from the escalate's approval_action).
// Resolves them to real Okta ids and adds the user to the group.
//
// Persistence is ephemeral/frontend-only, so the action travels in the body
// rather than being looked up by submissionId server-side. The frontend advances
// the submission to `approved` ONLY on a 200 here — a failure leaves it pending
// and surfaces the error, never a half-state where Okta is unchanged but the UI
// says approved.
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const { user_id, group_id } = body as { user_id?: unknown; group_id?: unknown };
  if (typeof user_id !== "string" || typeof group_id !== "string") {
    return NextResponse.json(
      { error: "Fields 'user_id' and 'group_id' are required strings." },
      { status: 400 },
    );
  }

  const result = await addUserToGroup(user_id, group_id);
  if (!result.ok) {
    // 502: the write to the upstream identity provider failed. The admin UI shows
    // "Approval failed — [reason]" and the submission stays pending_approval.
    return NextResponse.json(
      { error: result.error ?? "Okta write failed." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
