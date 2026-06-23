import { NextResponse } from "next/server";
import { resetAllPersonas } from "@/lib/reset-personas";

// GET /api/reset — restores every demo persona to its seeded Okta group state
// (SID-74). Invoked hourly by the Vercel cron in vercel.json, so reviewer
// experiments (submit → approve writes a real group grant) don't pollute across
// demos. Reads filesystem (scenario.json) + calls Okta → Node.js runtime, not edge.
export const runtime = "nodejs";

// Vercel cron sends `Authorization: Bearer $CRON_SECRET` automatically when the
// CRON_SECRET env var is set. Fail CLOSED: a missing secret or any mismatch is a
// 401, so the endpoint is never open even if the env var is forgotten.
function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.warn("[reset] CRON_SECRET is not set — refusing all requests.");
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await resetAllPersonas();
    if (!result.configured) {
      // Okta token missing — nothing to reset. Surface distinctly from a 401.
      return NextResponse.json(
        { error: "Okta is not configured." },
        { status: 503 },
      );
    }
    // Cron-observability line: the diff lands in the Vercel function logs.
    const summary = result.personas
      .map((p) =>
        [...p.added.map((g) => `+${g}`), ...p.removed.map((g) => `-${g}`)].join(
          " ",
        ),
      )
      .filter(Boolean)
      .join(" · ");
    console.info(
      `[reset] ${result.changed ? `applied: ${summary}` : "no change — already seeded"}`,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reset failed.";
    console.error("[reset] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
