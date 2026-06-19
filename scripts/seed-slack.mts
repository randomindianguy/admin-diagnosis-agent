// Seed the Slack test workspace with the routing channels the agent references
// (SID-61). At runtime the orchestration verifies these exist before routing a
// user to them. Idempotent: an already-existing channel is reused.
//
// Channels derive from the canonical escalation owners + resource owners:
//   identity-team, security-team, support-team (escalation classes)
//   strategy-team (owner of the Q3 strategy plan, for owner-routing)
//
// Run: node --env-file=.env.local scripts/seed-slack.mts

const TOKEN = process.env.SLACK_BOT_TOKEN!;
if (!TOKEN) throw new Error("SLACK_BOT_TOKEN missing");

const CHANNELS = ["identity-team", "security-team", "support-team", "strategy-team"];

async function slack(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function findChannel(name: string): Promise<string | null> {
  // Paginate public channels looking for an exact name match.
  let cursor: string | undefined;
  do {
    const r: any = await slack("conversations.list", {
      exclude_archived: true,
      types: "public_channel",
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    if (!r.ok) throw new Error(`conversations.list: ${r.error}`);
    const hit = (r.channels as any[]).find((c) => c.name === name);
    if (hit) return hit.id;
    cursor = r.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return null;
}

async function main() {
  console.log("Seeding Slack routing channels…");
  for (const name of CHANNELS) {
    const created: any = await slack("conversations.create", { name });
    if (created.ok) {
      console.log(`  #${name} → created (${created.channel.id})`);
    } else if (created.error === "name_taken") {
      const id = await findChannel(name);
      console.log(`  #${name} → exists (${id ?? "?"})`);
    } else {
      throw new Error(`create #${name}: ${created.error}`);
    }
  }
  console.log("Slack seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
