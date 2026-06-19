// Real Notion knowledge source for retrieveTopK() (SID-61). Reads the runbook
// pages under NOTION_PARENT_PAGE_ID and returns them as {source, text} corpus
// docs for Voyage embedding — same shape as reading reference-library/*.md.
//
// Returns null when not configured (no token) or on error → synthetic fallback.
// Memoized for the process lifetime.

export type CorpusDoc = { source: string; text: string };

type RichText = { plain_text?: string; text?: { content?: string } };
type Block = { type: string; [key: string]: unknown };
type ChildrenResp = { results: Block[]; has_more?: boolean; next_cursor?: string };

const TOKEN = process.env.NOTION_TOKEN;
const PARENT = process.env.NOTION_PARENT_PAGE_ID;
const VERSION = "2022-06-28";

async function notion<T>(method: string, path: string): Promise<T> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Notion-Version": VERSION },
  });
  if (!res.ok) throw new Error(`Notion ${path} → ${res.status}`);
  return (await res.json()) as T;
}

function plain(rt: RichText[] | undefined): string {
  return (rt ?? []).map((t) => t.plain_text ?? t.text?.content ?? "").join("");
}

async function pageText(pageId: string): Promise<string> {
  const lines: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion<ChildrenResp>(
      "GET",
      `/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`,
    );
    for (const b of res.results) {
      const node = b[b.type] as { rich_text?: RichText[] } | undefined;
      const text = plain(node?.rich_text);
      if (text) lines.push(text);
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return lines.join("\n");
}

let cache: Promise<CorpusDoc[] | null> | null = null;

export function getNotionCorpus(): Promise<CorpusDoc[] | null> {
  if (!TOKEN || !PARENT) return Promise.resolve(null);
  if (!cache) cache = build().catch(() => null);
  return cache;
}

async function build(): Promise<CorpusDoc[]> {
  const children = await notion<ChildrenResp>(
    "GET",
    `/blocks/${PARENT}/children?page_size=100`,
  );
  const pages = children.results.filter((c) => c.type === "child_page");
  const docs: CorpusDoc[] = [];
  for (const p of pages) {
    const cp = p.child_page as { title?: string } | undefined;
    const title = cp?.title ?? (p.id as string);
    const text = await pageText(p.id as string);
    // Prepend the title so it embeds like the markdown H1 did.
    docs.push({ source: title, text: `# ${title}\n\n${text}` });
  }
  if (docs.length === 0) throw new Error("Notion parent has no child pages");
  return docs;
}
