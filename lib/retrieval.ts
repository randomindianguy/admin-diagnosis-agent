// Retrieval — Q1's two channels + an orchestrator.
//
//   Channel 1 (similarity-shaped): embedding search over the runbook corpus.
//     Finds the right *mechanism* page. Embeddings via Voyage `voyage-4-lite`
//     (Q8), called over REST with Node's global fetch — no SDK dependency.
//   Channel 2 (identity-shaped): direct lookup in the scenario's status picture.
//     Finds what's *actually true* about the referenced user/resource — including
//     the nested subgroup the operator never named.
//
// The orchestrator runs both and exposes the top runbook similarity score, which
// the evidence-sufficiency gate reads at step 7. The score is internal — it is
// NOT part of DiagnosisOutput (schema.ts owns that contract).
//
// SUB-DECISIONS:
//   - Chunking (Q9, decided): whole-page, no overlap — see loadCorpus.
//   - Embed-timing (Q10, PENDING Sid's call before wiring downstream): lazy +
//     module-scope memoized (embed corpus on first query, cache for the process
//     lifetime) — see getEmbeddedCorpus.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { RetrievedEvidence } from "./schema";
// SID-61: real workspace sources. Each returns null when not configured (e.g. the
// eval workspace has no tokens) or on error → we fall back to synthetic data.
// SID-65: Slack is NOT imported here. It is operational *context*, not evidence —
// the model's inputs are strictly Okta identity + Notion knowledge. Slack lives
// only in the display-layer path (lib/operational-context.ts), fetched after the
// verdict commits, so it can never reach the model or the verdict contract.
import { getOktaPicture } from "./sources/okta";
import { getNotionCorpus } from "./sources/notion";

// ---------------------------------------------------------------------------
// Channel 1 — runbook similarity retrieval (Voyage embeddings)
// ---------------------------------------------------------------------------

const VOYAGE_MODEL = "voyage-4-lite"; // locked in CHUNK2-DESIGN-DECISIONS Q8
const VOYAGE_ENDPOINT = "https://api.voyageai.com/v1/embeddings";
const REFERENCE_LIBRARY_DIR = join(process.cwd(), "reference-library");
const SCENARIO_PATH = join(process.cwd(), "scenario.json");

// Evidence plus its similarity score. The score feeds the evidence-sufficiency
// gate (step 7); it is stripped before the evidence reaches DiagnosisOutput.
export type RankedEvidence = RetrievedEvidence & { score: number };

interface VoyageResponse {
  data: { embedding: number[]; index: number }[];
}

// Voyage supports input_type to optimize query- vs document-side embeddings.
async function voyageEmbed(
  input: string[],
  inputType: "query" | "document",
): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error(
      "VOYAGE_API_KEY is not set. Add it to .env.local (see .env.local.example).",
    );
  }
  const res = await fetch(VOYAGE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ input, model: VOYAGE_MODEL, input_type: inputType }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage embeddings request failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as VoyageResponse;
  // Preserve input order — Voyage returns an `index` per embedding.
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

interface CorpusDoc {
  source: string;
  text: string;
}

// CHUNKING (Q9; course ref Deepak 8.2.5 — axes: chunk size / overlap / content
// type): whole-page, chunk size = document size, no overlap. The LIMIT CASE of
// the completeness principle — no internal boundaries means nothing for overlap
// to preserve completeness across, so the whole mechanism stays in one vector.
// When a page grows long/multi-topic enough to split, overlap becomes the default
// (8.2.5) and this shifts to by-heading chunks with an overlap window.
function loadCorpus(): CorpusDoc[] {
  const files = readdirSync(REFERENCE_LIBRARY_DIR).filter((f) =>
    f.endsWith(".md"),
  );
  return files.map((f) => ({
    source: f,
    text: readFileSync(join(REFERENCE_LIBRARY_DIR, f), "utf8"),
  }));
}

// EMBED-TIMING (Q10; course ref Deepak 8.1.5 / 8.1.1 — embedding is PRE-PROCESSING,
// structurally separate from retrieval runtime): lazy + module-scope memoized.
// The corpus embeds once on the FIRST query and is cached for the process lifetime
// — the pragmatic compromise: pre-processing happens once, deferred into first
// retrieval (vs per-request, which would conflate pre-processing with retrieval).
// Module-load is the stronger expression but couples import to a network call —
// brittle under Next's module graph / HMR / missing-key-at-import. Chunk-7
// serverless escape hatch: precompute embeddings to a file at build time.
interface EmbeddedDoc extends CorpusDoc {
  embedding: number[];
}
let corpusPromise: Promise<EmbeddedDoc[]> | null = null;
export let knowledgeSource: "notion" | "synthetic" = "synthetic";

function getEmbeddedCorpus(): Promise<EmbeddedDoc[]> {
  if (!corpusPromise) {
    corpusPromise = (async () => {
      // SID-61: prefer the live Notion runbook; fall back to reference-library/.
      const notion = await getNotionCorpus();
      const docs = notion ?? loadCorpus();
      knowledgeSource = notion ? "notion" : "synthetic";
      const embeddings = await voyageEmbed(
        docs.map((d) => d.text),
        "document",
      );
      return docs.map((d, i) => ({ ...d, embedding: embeddings[i] }));
    })();
  }
  return corpusPromise;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Channel 1: embed the symptom, score it against every corpus page, return
// matches sorted by descending similarity.
export async function retrieveRunbook(
  symptom: string,
): Promise<RankedEvidence[]> {
  const corpus = await getEmbeddedCorpus();
  const [queryEmbedding] = await voyageEmbed([symptom], "query");
  return corpus
    .map((d) => ({
      source: d.source,
      snippet: d.text,
      score: cosine(queryEmbedding, d.embedding),
    }))
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Channel 2 — identity-shaped status fetch (local JSON, no embeddings)
// ---------------------------------------------------------------------------

interface StatusUser {
  id: string;
  name: string;
  direct_group_memberships: string[];
}
interface StatusGroup {
  id: string;
  name: string;
  parent?: string;
}
interface StatusResource {
  id: string;
  name: string;
  grants: { principal: string; level: string }[];
  // SID-56 Phase 3: optional owner metadata. When a resource is owner-controlled
  // and the user has no group path to it, the resolve answer routes them to the
  // owner (resource_owner_routing) rather than diagnosing a failure.
  owner?: string;
}
interface StatusPicture {
  users: StatusUser[];
  groups: StatusGroup[];
  resources: StatusResource[];
}

// The filtered slice of the status picture relevant to this symptom.
export interface StatusFacts {
  users: StatusUser[];
  groups: StatusGroup[];
  resources: StatusResource[];
}

// Chunk-2 simplification: one scenario (Seed 1), so the status picture is read
// from scenario.json. Scenario selection becomes a real concern when chunks 3–6
// add more seeds; not chunk-2's call.
//
// SID-56 Phase 3: scenario.json now also carries a `current_user` — the logged-in
// end user. Messages written first-person without naming anyone ("I need access
// to the analytics dashboard") resolve to this user; a message that names someone
// else (e.g. "Maya") still binds to them. No auth in this demo; the current user
// is fixed in the scenario file.
function loadScenario(): { picture: StatusPicture; currentUserId?: string } {
  const scenario = JSON.parse(readFileSync(SCENARIO_PATH, "utf8")) as {
    setup: { status_picture: StatusPicture; current_user?: string };
  };
  return {
    picture: scenario.setup.status_picture,
    currentUserId: scenario.setup.current_user,
  };
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Channel 2: find entities the symptom references, then graph-expand so the
// truth the operator missed surfaces.
export let identitySource: "okta" | "synthetic" = "synthetic";

// Assemble the status picture: live Okta identity (users / groups / memberships /
// parent_group) when configured, else synthetic. Resources + current_user always
// come from scenario.json (app-specific data, per the SID-61 architecture). The
// Okta source is re-keyed to the scenario id scheme so the filtering below and the
// scenario.json resource principals match unchanged.
async function buildPicture(): Promise<{
  picture: StatusPicture;
  currentUserId?: string;
}> {
  const synthetic = loadScenario();
  const okta = await getOktaPicture();
  identitySource = okta ? "okta" : "synthetic";
  if (okta) {
    return {
      picture: {
        users: okta.users,
        groups: okta.groups,
        resources: synthetic.picture.resources,
      },
      currentUserId: synthetic.currentUserId,
    };
  }
  return synthetic;
}

export async function fetchStatus(symptom: string): Promise<StatusFacts> {
  const { picture, currentUserId } = await buildPicture();
  const haystack = norm(symptom);

  // 1. Users referenced by full name or a significant name token ("Maya").
  const named = picture.users.filter((u) => {
    const full = norm(u.name);
    if (haystack.includes(full)) return true;
    return full.split(" ").some((tok) => tok.length > 2 && haystack.includes(tok));
  });

  // SID-56 Phase 3: if the message names no one, it's the logged-in current user
  // speaking ("I need access to…"). Fall back to them so first-person requests
  // have an identity to reason about. A message that DID name someone keeps that
  // binding (so Maya's scenario is unaffected).
  const currentUser =
    named.length === 0 && currentUserId
      ? picture.users.filter((u) => u.id === currentUserId)
      : [];
  const matchedUsers = named.length > 0 ? named : currentUser;

  // 2. Graph-expand from matched users to the groups they're ACTUALLY in — e.g.
  //    data-team-ml, the nested subgroup the operator never named.
  const groupIds = new Set<string>();
  for (const u of matchedUsers) {
    for (const g of u.direct_group_memberships) groupIds.add(g);
  }

  // 3. Groups the symptom names directly ("data-team").
  for (const g of picture.groups) {
    if (haystack.includes(norm(g.name))) groupIds.add(g.id);
  }

  // 4. Parent chain of every collected group (parents hold the grants subgroups
  //    don't inherit — exactly the fact the diagnosis needs).
  let frontier = [...groupIds];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      const g = picture.groups.find((x) => x.id === id);
      if (g?.parent && !groupIds.has(g.parent)) {
        groupIds.add(g.parent);
        next.push(g.parent);
      }
    }
    frontier = next;
  }
  // 5. Resources the symptom references.
  //    - If the message names a resource by its full name, that reference is
  //      unambiguous: surface that resource (plus any the user's groups grant, so
  //      "you already have it" can be confirmed).
  //    - If it names NO resource by full name (a generic "the dashboard"), surface
  //      the whole catalog so the model can SEE whether more than one resource
  //      could be meant — that's what lets it refuse resource_ambiguity instead of
  //      silently picking the one the user happens to have access to.
  const nameMatched = picture.resources.filter((r) =>
    haystack.includes(norm(r.name)),
  );
  const resources =
    nameMatched.length > 0
      ? picture.resources.filter(
          (r) =>
            haystack.includes(norm(r.name)) ||
            r.grants.some((grant) => groupIds.has(grant.principal)),
        )
      : [...picture.resources];

  // 6. (SID-56 Phase 3) Surface the groups a matched resource grants to, even if
  //    the user isn't in them — so "this resource requires data-team, and you're
  //    not in it" reads with real group names (the onboarding-gap escalate), not
  //    raw ids. Pull in their parent chains too for completeness.
  for (const r of resources) {
    for (const grant of r.grants) {
      if (picture.groups.some((g) => g.id === grant.principal)) {
        groupIds.add(grant.principal);
      }
    }
  }
  frontier = [...groupIds];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      const g = picture.groups.find((x) => x.id === id);
      if (g?.parent && !groupIds.has(g.parent)) {
        groupIds.add(g.parent);
        next.push(g.parent);
      }
    }
    frontier = next;
  }
  const groups = picture.groups.filter((g) => groupIds.has(g.id));

  return { users: matchedUsers, groups, resources };
}

// ---------------------------------------------------------------------------
// Orchestrator — both channels, plus the score the gate reads
// ---------------------------------------------------------------------------

export interface RetrievalResult {
  runbook: RankedEvidence[];
  status: StatusFacts;
  topScore: number; // max runbook similarity; feeds evidence-sufficiency (step 7)
  // Provenance of the EVIDENCE the model reasons over (live vs synthetic). Slack
  // is deliberately absent — it is context, not evidence (SID-65).
  sources: {
    identity: "okta" | "synthetic";
    knowledge: "notion" | "synthetic";
  };
}

export async function retrieveContext(
  symptom: string,
): Promise<RetrievalResult> {
  // Evidence only: retrieveRunbook sets knowledgeSource; fetchStatus sets
  // identitySource. No Slack here — operational context is fetched after the
  // verdict commits (lib/operational-context.ts), never before.
  const runbook = await retrieveRunbook(symptom);
  const status = await fetchStatus(symptom);
  const topScore = runbook.length ? runbook[0].score : 0;
  const sources = { identity: identitySource, knowledge: knowledgeSource };
  console.info(
    `[retrieval] evidence → identity:${sources.identity} knowledge:${sources.knowledge}`,
  );
  return { runbook, status, topScore, sources };
}
