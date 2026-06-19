// Real Slack source for routing verification (SID-61). Lists the workspace's
// public channels so the orchestration can confirm a routing destination (an
// escalation team, a resource owner) actually exists before recommending it.
//
// Returns null when not configured or on error → caller treats verification as
// unavailable (falls back to not blocking). Memoized for the process lifetime.

type SlackChannel = { id: string; name: string };
type ListResp = {
  ok: boolean;
  error?: string;
  channels?: SlackChannel[];
  response_metadata?: { next_cursor?: string };
};

const TOKEN = process.env.SLACK_BOT_TOKEN;

let cache: Promise<Set<string> | null> | null = null;

export function getRoutingChannels(): Promise<Set<string> | null> {
  if (!TOKEN) return Promise.resolve(null);
  if (!cache) cache = build().catch(() => null);
  return cache;
}

async function build(): Promise<Set<string>> {
  const names = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = await fetch(
      `https://slack.com/api/conversations.list?exclude_archived=true&types=public_channel&limit=200${cursor ? `&cursor=${cursor}` : ""}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
    const json = (await res.json()) as ListResp;
    if (!json.ok) throw new Error(`Slack conversations.list → ${json.error}`);
    for (const c of json.channels ?? []) names.add(c.name);
    cursor = json.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return names;
}
