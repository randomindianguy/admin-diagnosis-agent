import { NextResponse } from "next/server";
import { getChannelContext } from "@/lib/sources/slack";

// GET /api/operational-context?channel=<name> → { context: ChannelContext | null }
//
// Display-layer only (SID-65): the admin trace calls this AFTER a verdict is
// already committed/stored, to show recent activity in the routing destination's
// Slack channel. Never part of the diagnosis pipeline. Always returns 200 with a
// possibly-null context — any Slack failure degrades to no context block.
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const channel = new URL(request.url).searchParams.get("channel");
  if (!channel) return NextResponse.json({ context: null });
  const context = await getChannelContext(channel);
  return NextResponse.json({ context });
}
