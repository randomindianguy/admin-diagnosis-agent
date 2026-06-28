import { NextResponse } from "next/server";
import { resetAllPersonas } from "@/lib/reset-personas";

// POST /api/reset-public — visitor-triggered demo reset (SID-82). Unlike the
// CRON_SECRET-gated GET /api/reset, this is INTENTIONALLY unauthenticated: during
// a broadcast the hourly cron can't keep up with peak traffic, so any visitor can
// clear the demo back to baseline on demand. Calls the SAME resetAllPersonas() the
// cron uses; the gated route is left untouched as the safety net. Reads
// scenario.json + writes Okta → Node.js runtime, not edge.
export const runtime = "nodejs";

// Best-effort in-memory per-IP rate limit: 1 reset / 30s. On Vercel each warm
// instance keeps its own Map, so this is a SOFT throttle, not a hard guarantee —
// fine for a demo (the ~3s Okta round-trip is itself a natural brake). All it
// guards against is one client hammering a single warm instance.
const RESET_COOLDOWN_MS = 30_000;
const lastResetByIp = new Map<string, number>();

function clientIp(request: Request): string {
  // x-forwarded-for is a comma-separated chain; the first entry is the client.
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request): Promise<Response> {
  const ip = clientIp(request);
  const now = Date.now();
  const last = lastResetByIp.get(ip);
  if (last && now - last < RESET_COOLDOWN_MS) {
    const retryAfter = Math.ceil((RESET_COOLDOWN_MS - (now - last)) / 1000);
    return NextResponse.json(
      { error: `Too many resets — try again in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  // Claim the slot BEFORE the ~3s Okta round-trip so a burst of concurrent clicks
  // can't all pass the check before any completes. Released on failure below so an
  // error never locks the user out of an immediate retry.
  lastResetByIp.set(ip, now);

  try {
    const result = await resetAllPersonas();
    if (!result.configured) {
      lastResetByIp.delete(ip);
      return NextResponse.json(
        { error: "Okta is not configured." },
        { status: 503 },
      );
    }
    console.info(
      `[reset-public] ${result.changed ? "applied" : "no change — already seeded"} (ip ${ip})`,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    lastResetByIp.delete(ip);
    const message = err instanceof Error ? err.message : "Reset failed.";
    console.error("[reset-public] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
