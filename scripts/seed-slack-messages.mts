// Seed the routing channels with realistic chatter so the workspace doesn't look
// hollow on a screen-share (SID-61 set dressing — NOT consumed by the agent).
// Uses chat:write.customize for per-message username + icon_emoji. Idempotent via
// a local marker file (channels:history isn't granted): a channel already in
// scripts/.slack-seeded.json is skipped, so re-running won't pile up duplicates.
//
// Run: node --env-file=.env.local scripts/seed-slack-messages.mts

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const TOKEN = process.env.SLACK_BOT_TOKEN!;
if (!TOKEN) throw new Error("SLACK_BOT_TOKEN missing");

const MARKER = join(process.cwd(), "scripts", ".slack-seeded.json");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function slack(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    ts?: string;
    channels?: { id: string; name: string }[];
    response_metadata?: { next_cursor?: string };
  };
}

type Msg = { user: string; text: string; replyTo?: number; reactions?: string[] };
type Channel = { name: string; people: Record<string, string>; messages: Msg[] };

const CHANNELS: Channel[] = [
  {
    name: "identity-team",
    people: {
      "Priya Nair": ":woman-tipping-hand:",
      "Alex Chen": ":man-technologist:",
      "Sam Okafor": ":bust_in_silhouette:",
      "Marcus Webb": ":coffee:",
      "Jen Liu": ":woman-technologist:",
      "Devon Park": ":technologist:",
    },
    messages: [
      { user: "Priya Nair", text: "another request for analytics-team viewer access, second this week" },
      { user: "Marcus Webb", text: "approve it, theyre all the new hires", replyTo: 0 },
      { user: "Priya Nair", text: "yeah did the batch", replyTo: 0 },
      { user: "Sam Okafor", text: "@here can someone batch through the onboarding queue, backed up since wednesday", reactions: ["eyes"] },
      { user: "Jen Liu", text: "on it", replyTo: 3, reactions: ["white_check_mark"] },
      { user: "Alex Chen", text: "scim sync ran twice last night, anyone else seeing dupes" },
      { user: "Devon Park", text: "ugh", replyTo: 5 },
      { user: "Devon Park", text: "yeah okta pushed two cycles, cleaning up now", replyTo: 5 },
      { user: "Marcus Webb", text: "whos owner on data-team-ml these days" },
      { user: "Priya Nair", text: "still maya i think", replyTo: 8 },
      { user: "Sam Okafor", text: "maya yeah", replyTo: 8 },
      { user: "Jen Liu", text: "doing the contractor offboard, can someone double check the group removals" },
      { user: "Alex Chen", text: "checked, hes out of everything except the shared drive", replyTo: 11 },
      { user: "Jen Liu", text: "ill grab that one", replyTo: 11, reactions: ["thumbsup"] },
      { user: "Marcus Webb", text: "reminder the access request form moved, stop dm'ing me" },
      { user: "Devon Park", text: "lol", replyTo: 14 },
      { user: "Priya Nair", text: "new joiner monday, analytics. provisioning now" },
      { user: "Sam Okafor", text: "groups only or full", replyTo: 16 },
      { user: "Priya Nair", text: "full", replyTo: 16 },
      { user: "Alex Chen", text: "anyone know why the warehouse group isnt reaching the dashboards" },
      { user: "Devon Park", text: "its the nested group thing again", replyTo: 19 },
      { user: "Devon Park", text: "inheritance doesnt carry, has to be a direct grant", replyTo: 19, reactions: ["thinking_face"] },
      { user: "Marcus Webb", text: "coffee machine on 3 is down btw" },
      { user: "Jen Liu", text: "tragic", replyTo: 22 },
    ],
  },
  {
    name: "security-team",
    people: {
      "Raj Patel": ":lock:",
      "Maya Rao": ":detective:",
      "Nina Foster": ":woman-technologist:",
      "Omar Haddad": ":shield:",
      "Chloe Davis": ":bust_in_silhouette:",
    },
    messages: [
      { user: "Raj Patel", text: "q3 access review kicks off next week, scoping it now" },
      { user: "Nina Foster", text: "same group set as last time", replyTo: 0 },
      { user: "Raj Patel", text: "mostly, adding the analytics groups this round", replyTo: 0, reactions: ["white_check_mark"] },
      { user: "Omar Haddad", text: "any movement on the yubikey rollout" },
      { user: "Chloe Davis", text: "stuck in procurement", replyTo: 3 },
      { user: "Omar Haddad", text: "of course", replyTo: 3 },
      { user: "Maya Rao", text: "got a flag on the incident from tuesday, looks like a false positive" },
      { user: "Raj Patel", text: "the data-team one", replyTo: 6 },
      { user: "Maya Rao", text: "yeah, legit access just looked odd in the logs", replyTo: 6, reactions: ["eyes"] },
      { user: "Nina Foster", text: "password policy doc is up for review, comments by friday" },
      { user: "Chloe Davis", text: "will look", replyTo: 9 },
      { user: "Omar Haddad", text: "are we still on 90 day rotation or did that change" },
      { user: "Raj Patel", text: "moving to passphrase plus mfa, dropping the rotation", replyTo: 11 },
      { user: "Omar Haddad", text: "finally", replyTo: 11, reactions: ["thumbsup"] },
      { user: "Maya Rao", text: "reminder dont approve standing access during the audit window" },
      { user: "Nina Foster", text: "noted" },
      { user: "Chloe Davis", text: "the vendor risk assessment is overdue, who owns it" },
      { user: "Raj Patel", text: "think it got reassigned, lemme check", replyTo: 16 },
      { user: "Omar Haddad", text: "conditional access rule is live, watching for noise" },
      { user: "Maya Rao", text: "saw a couple denials already, mostly mobile", replyTo: 18 },
      { user: "Nina Foster", text: "expected, policy excludes the old app", replyTo: 18 },
      { user: "Raj Patel", text: "review owners list goes out today, check your queue" },
      { user: "Chloe Davis", text: "👀" },
    ],
  },
  {
    name: "support-team",
    people: {
      "Tom Becker": ":headphones:",
      "Dana Ruiz": ":woman-technologist:",
      "Kev Mwangi": ":coffee:",
      "Sara Lin": ":bust_in_silhouette:",
      "Bryce Tanaka": ":man-technologist:",
    },
    messages: [
      { user: "Kev Mwangi", text: "queue is brutal today" },
      { user: "Sara Lin", text: "what happened", replyTo: 0 },
      { user: "Kev Mwangi", text: "warehouse access tickets, like 15 of them", replyTo: 0 },
      { user: "Sara Lin", text: "all the same root cause", replyTo: 0 },
      { user: "Kev Mwangi", text: "yeah the group thing", replyTo: 0, reactions: ["eyes"] },
      { user: "Tom Becker", text: "anyone seen alex from analytics, hes got a ticket open and not replying" },
      { user: "Dana Ruiz", text: "he was ooo i think", replyTo: 5 },
      { user: "Tom Becker", text: "ah that explains it", replyTo: 5 },
      { user: "Bryce Tanaka", text: "user says the dashboard wont load" },
      { user: "Sara Lin", text: "did he try clearing cache", replyTo: 8 },
      { user: "Bryce Tanaka", text: "yes obviously", replyTo: 8 },
      { user: "Sara Lin", text: "lol classic", replyTo: 8 },
      { user: "Dana Ruiz", text: "closing the duplicate warehouse tickets, pointing them all to one" },
      { user: "Kev Mwangi", text: "bless", replyTo: 12, reactions: ["thumbsup"] },
      { user: "Tom Becker", text: "whats the eta on the password reset self service" },
      { user: "Bryce Tanaka", text: "identity has it, no date", replyTo: 14 },
      { user: "Kev Mwangi", text: "someone reopened a ticket from march" },
      { user: "Sara Lin", text: "why", replyTo: 16 },
      { user: "Kev Mwangi", text: "no idea, closed it again", replyTo: 16 },
      { user: "Dana Ruiz", text: "printer on 2 again" },
      { user: "Tom Becker", text: "its always the printer", replyTo: 19, reactions: ["eyes"] },
      { user: "Bryce Tanaka", text: "laptop swap for the new designer, who has stock" },
      { user: "Dana Ruiz", text: "supply closet, grab one", replyTo: 21 },
      { user: "Kev Mwangi", text: "queue down to 8, were winning", reactions: ["white_check_mark"] },
    ],
  },
  {
    name: "strategy-team",
    people: {
      "Helena Ross": ":briefcase:",
      "Daniel Cho": ":bust_in_silhouette:",
      "Aisha Bello": ":woman-technologist:",
      "Greg Salinas": ":coffee:",
    },
    messages: [
      { user: "Helena Ross", text: "q3 plan draft is up, sharing the doc now" },
      { user: "Daniel Cho", text: "thanks, will review before monday", replyTo: 0, reactions: ["thumbsup"] },
      { user: "Aisha Bello", text: "is the kickoff still monday" },
      { user: "Helena Ross", text: "yes 10am, calendar invite went out", replyTo: 2 },
      { user: "Greg Salinas", text: "+1", replyTo: 2 },
      { user: "Daniel Cho", text: "can we hold the revenue section, numbers arent final" },
      { user: "Helena Ross", text: "leave it as draft for now, well update before the readout", replyTo: 5 },
      { user: "Aisha Bello", text: "whos taking the analytics piece" },
      { user: "Greg Salinas", text: "i can take it", replyTo: 7, reactions: ["white_check_mark"] },
      { user: "Helena Ross", text: "doc has comments from finance, working through them today" },
      { user: "Daniel Cho", text: "the headcount slide needs work" },
      { user: "Helena Ross", text: "agreed, parking it", replyTo: 10 },
      { user: "Aisha Bello", text: "moving our 1:1 to thursday if thats ok" },
      { user: "Helena Ross", text: "works", replyTo: 12 },
      { user: "Greg Salinas", text: "offsite dates, are we locked" },
      { user: "Daniel Cho", text: "tentative, waiting on the venue", replyTo: 14 },
      { user: "Helena Ross", text: "board readout is the 28th, drafts by the 21st" },
      { user: "Aisha Bello", text: "noted", reactions: ["eyes"] },
      { user: "Greg Salinas", text: "dropped the competitive analysis in the folder" },
      { user: "Daniel Cho", text: "great, will fold it in", replyTo: 18 },
      { user: "Helena Ross", text: "agenda is in the invite, take a look before monday" },
      { user: "Aisha Bello", text: "👀" },
    ],
  },
];

async function channelIdByName(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const r = await slack("conversations.list", {
      exclude_archived: true,
      types: "public_channel",
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    if (!r.ok) throw new Error(`conversations.list: ${r.error}`);
    for (const c of r.channels ?? []) map.set(c.name, c.id);
    cursor = r.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return map;
}

function loadMarker(): Set<string> {
  if (!existsSync(MARKER)) return new Set();
  try {
    return new Set(JSON.parse(readFileSync(MARKER, "utf8")) as string[]);
  } catch {
    return new Set();
  }
}
function saveMarker(seeded: Set<string>) {
  writeFileSync(MARKER, JSON.stringify([...seeded], null, 2));
}

async function seedChannel(ch: Channel, id: string) {
  const ts: (string | undefined)[] = [];
  for (let i = 0; i < ch.messages.length; i++) {
    const m = ch.messages[i];
    const body: Record<string, unknown> = {
      channel: id,
      text: m.text,
      username: m.user,
      icon_emoji: ch.people[m.user] ?? ":bust_in_silhouette:",
    };
    if (m.replyTo !== undefined && ts[m.replyTo]) body.thread_ts = ts[m.replyTo];
    const r = await slack("chat.postMessage", body);
    if (!r.ok) throw new Error(`postMessage #${ch.name}[${i}]: ${r.error}`);
    ts[i] = r.ts;
    await sleep(400);
    for (const name of m.reactions ?? []) {
      await slack("reactions.add", { channel: id, timestamp: r.ts, name });
      await sleep(200);
    }
  }
  console.log(`  #${ch.name}: posted ${ch.messages.length} messages`);
}

async function main() {
  console.log("Seeding Slack conversation…");
  const ids = await channelIdByName();
  const seeded = loadMarker();
  for (const ch of CHANNELS) {
    const id = ids.get(ch.name);
    if (!id) {
      console.warn(`  #${ch.name}: channel not found, skipping`);
      continue;
    }
    if (seeded.has(ch.name)) {
      console.log(`  #${ch.name}: already seeded (marker), skipping`);
      continue;
    }
    await seedChannel(ch, id);
    seeded.add(ch.name);
    saveMarker(seeded);
  }
  console.log("Slack message seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
