// Slack operational-context source (SID-65). DISPLAY-LAYER ONLY — read from the
// admin path after a verdict commits, never by the diagnosis pipeline. Reads
// recent messages from a team's channel so the admin trace can show that the
// routing destination is a real, active channel.
//
// Returns null when not configured (no token) or on any error → the caller shows
// no context block (graceful; never an error state).

type SlackChannel = { id: string; name: string };
type ListResp = {
  ok: boolean;
  error?: string;
  channels?: SlackChannel[];
  response_metadata?: { next_cursor?: string };
};
type SlackMessage = {
  text?: string;
  user?: string;
  username?: string; // set when the message was posted with a username override
  subtype?: string; // channel_join etc. — skip these
};
type HistoryResp = { ok: boolean; error?: string; messages?: SlackMessage[] };

export type ChannelContext = {
  channel: string;
  messages: { user: string; text: string }[];
};

const TOKEN = process.env.SLACK_BOT_TOKEN;

// Channel name → id, memoized (channels don't change during a session).
let channelMap: Promise<Map<string, string> | null> | null = null;

function getChannelMap(): Promise<Map<string, string> | null> {
  if (!TOKEN) return Promise.resolve(null);
  if (!channelMap) channelMap = buildMap().catch(() => null);
  return channelMap;
}

async function buildMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const res = await fetch(
      `https://slack.com/api/conversations.list?exclude_archived=true&types=public_channel&limit=200${cursor ? `&cursor=${cursor}` : ""}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
    const json = (await res.json()) as ListResp;
    if (!json.ok) throw new Error(`Slack conversations.list → ${json.error}`);
    for (const c of json.channels ?? []) map.set(c.name, c.id);
    cursor = json.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return map;
}

// Post-verdict notification (SID-66). DISPLAY/ORCHESTRATION-LAYER ONLY — called
// from the API route AFTER a verdict commits, never by the diagnosis pipeline.
// Posts as the "Cleared" bot (chat:write.customize) so the message reads as the
// agent announcing a verdict it already made. Returns { ok:false } (never throws)
// when not configured, the channel is unknown, or Slack rejects the post — the
// caller degrades to no-post, identical verdict response.
//
// SID-70: on success it also captures the message permalink (chat.getPermalink)
// so the end-user "view in Slack" link for team-routed escalates can deep-link to
// the exact thread. Permalink capture failures are non-fatal (ok stays true).
export async function postNotification(
  channelName: string,
  text: string,
): Promise<{ ok: boolean; permalink?: string }> {
  if (!TOKEN) return { ok: false };
  try {
    const map = await getChannelMap();
    const id = map?.get(channelName);
    if (!id) return { ok: false };
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: id,
        text,
        username: "Cleared",
        icon_emoji: ":shield:",
      }),
    });
    const json = (await res.json()) as { ok: boolean; ts?: string };
    if (!json.ok) return { ok: false };

    let permalink: string | undefined;
    try {
      const plRes = await fetch(
        `https://slack.com/api/chat.getPermalink?channel=${id}&message_ts=${json.ts}`,
        { headers: { Authorization: `Bearer ${TOKEN}` } },
      );
      const pl = (await plRes.json()) as { ok: boolean; permalink?: string };
      if (pl.ok) permalink = pl.permalink;
    } catch {
      // permalink is best-effort; the post still succeeded
    }
    return { ok: true, permalink };
  } catch {
    return { ok: false };
  }
}

export async function getChannelContext(
  name: string,
  limit = 4,
): Promise<ChannelContext | null> {
  if (!TOKEN) return null;
  try {
    const map = await getChannelMap();
    const id = map?.get(name);
    if (!id) return null;
    // Over-fetch then filter out system messages, take the newest `limit`, and
    // present oldest→newest so it reads chronologically.
    const res = await fetch(
      `https://slack.com/api/conversations.history?channel=${id}&limit=20`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
    const json = (await res.json()) as HistoryResp;
    if (!json.ok) return null;
    const messages = (json.messages ?? [])
      // Keep real chatter (plain messages + our seeded bot_message posts); drop
      // system events like channel_join / channel_create.
      .filter((m) => m.text && (!m.subtype || m.subtype === "bot_message"))
      .slice(0, limit)
      .map((m) => ({
        user: m.username ?? m.user ?? "someone",
        text: m.text ?? "",
      }))
      .reverse();
    if (messages.length === 0) return null;
    return { channel: name, messages };
  } catch {
    return null;
  }
}
