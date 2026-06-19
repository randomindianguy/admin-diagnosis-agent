// Seed Notion with the runbook pages from reference-library/ (SID-61). Each .md
// becomes a Notion page under NOTION_PARENT_PAGE_ID; retrieveTopK() reads these
// at runtime and embeds them. Idempotent: archives existing child pages first.
//
// Run: node --env-file=.env.local scripts/seed-notion.mts

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const TOKEN = process.env.NOTION_TOKEN!;
const PARENT = process.env.NOTION_PARENT_PAGE_ID!;
const VERSION = "2022-06-28";
if (!TOKEN || !PARENT) throw new Error("NOTION_TOKEN / NOTION_PARENT_PAGE_ID missing");

async function notion(method: string, path: string, body?: unknown) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, json };
}

// --- Inline markdown → Notion rich_text (handles **bold** and `code`) ----------
function richText(line: string): any[] {
  const out: any[] = [];
  // split on **bold** and `code`, keep delimiters
  const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  for (const p of parts) {
    if (p.startsWith("**") && p.endsWith("**"))
      out.push({ type: "text", text: { content: p.slice(2, -2) }, annotations: { bold: true } });
    else if (p.startsWith("`") && p.endsWith("`"))
      out.push({ type: "text", text: { content: p.slice(1, -1) }, annotations: { code: true } });
    else out.push({ type: "text", text: { content: p } });
  }
  return out.length ? out : [{ type: "text", text: { content: line } }];
}

// --- Block-level markdown → Notion blocks. Returns { title, blocks }. ----------
function mdToBlocks(md: string): { title: string; blocks: any[] } {
  const lines = md.split("\n");
  let title = "Untitled";
  const blocks: any[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
    } else if (line.startsWith("### ")) {
      blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: richText(line.slice(4)) } });
    } else if (line.startsWith("## ")) {
      blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: richText(line.slice(3)) } });
    } else if (/^[-*] /.test(line)) {
      blocks.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: richText(line.slice(2)) } });
    } else {
      blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: richText(line) } });
    }
  }
  return { title, blocks };
}

async function clearExistingChildPages() {
  const res = await notion("GET", `/blocks/${PARENT}/children?page_size=100`);
  const children = (res.json.results ?? []) as any[];
  let archived = 0;
  for (const c of children) {
    if (c.type === "child_page") {
      await notion("PATCH", `/pages/${c.id}`, { archived: true });
      archived++;
    }
  }
  if (archived) console.log(`  archived ${archived} existing runbook page(s)`);
}

async function main() {
  console.log("Seeding Notion runbook pages…");
  await clearExistingChildPages();

  const dir = join(process.cwd(), "reference-library");
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  for (const f of files) {
    const md = readFileSync(join(dir, f), "utf8");
    const { title, blocks } = mdToBlocks(md);
    const created = await notion("POST", "/pages", {
      parent: { page_id: PARENT },
      properties: { title: { title: [{ text: { content: title } }] } },
    });
    if (created.status >= 300)
      throw new Error(`create page ${f}: ${JSON.stringify(created.json)}`);
    const pageId = created.json.id;
    // append in batches of 100 (Notion limit)
    for (let i = 0; i < blocks.length; i += 100) {
      const r = await notion("PATCH", `/blocks/${pageId}/children`, {
        children: blocks.slice(i, i + 100),
      });
      if (r.status >= 300)
        throw new Error(`append ${f}: ${JSON.stringify(r.json)}`);
    }
    console.log(`  ${f} → "${title}" (${blocks.length} blocks) → ${pageId}`);
  }
  console.log("Notion seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
