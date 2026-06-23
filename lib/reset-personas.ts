// Reset ALL demo personas to their seeded Okta group memberships. Extracted from
// scripts/reset-demo.mts (SID-72) into a shared lib (SID-74) so the CLI script AND
// the /api/reset cron endpoint run the SAME logic. scenario.json's
// status_picture.users is canonical — read at runtime so future scenario edits need
// no code change. For each persona: diff current Okta against the seed, add what's
// missing, remove what's extra. Idempotent (a clean run reports no change).
//
// Relative `.ts` imports (not the @/ alias) so this resolves both under the Next
// bundler AND under `node --env-file=… scripts/reset-demo.mts` (node type-stripping
// needs explicit extensions and can't resolve the alias).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getOktaPicture,
  invalidateOktaPicture,
  addUserToGroup,
  removeUserFromGroup,
} from "./sources/okta.ts";

type SeedUser = {
  id: string;
  name: string;
  direct_group_memberships: string[];
};

export type PersonaReset = {
  name: string;
  added: string[]; // groups granted to reach the seed state
  removed: string[]; // groups revoked to reach the seed state
  failed: string[]; // writes that errored, with the reason
};

export type ResetResult = {
  configured: boolean; // false when Okta isn't configured (no token) — caller decides
  changed: boolean; // any persona needed a write
  personas: PersonaReset[];
};

const short = (g: string) => g.replace(/^group:/, "");

export async function resetAllPersonas(): Promise<ResetResult> {
  const scenario = JSON.parse(
    readFileSync(join(process.cwd(), "scenario.json"), "utf8"),
  ) as { setup: { status_picture: { users: SeedUser[] } } };
  const desired = scenario.setup.status_picture.users;

  // Always diff against the REAL current Okta picture, never a stale cache. A demo
  // pollutes via app-internal writes (which clear the cache), but the cron can run
  // in a fresh/warm process — force a clean read so the diff is correct either way.
  invalidateOktaPicture();
  const picture = await getOktaPicture();
  if (!picture) {
    return { configured: false, changed: false, personas: [] };
  }
  const currentById = new Map(
    picture.users.map((u) => [u.id, new Set(u.direct_group_memberships)]),
  );

  const personas: PersonaReset[] = [];
  let changed = false;

  for (const u of desired) {
    const want = new Set(u.direct_group_memberships);
    const have = currentById.get(u.id) ?? new Set<string>();
    const toAdd = [...want].filter((g) => !have.has(g));
    const toRemove = [...have].filter((g) => !want.has(g));

    const added: string[] = [];
    const removed: string[] = [];
    const failed: string[] = [];

    for (const g of toAdd) {
      const r = await addUserToGroup(u.id, g);
      if (r.ok) added.push(short(g));
      else failed.push(`+${short(g)} (${r.error})`);
    }
    for (const g of toRemove) {
      const r = await removeUserFromGroup(u.id, g);
      if (r.ok) removed.push(short(g));
      else failed.push(`-${short(g)} (${r.error})`);
    }

    if (added.length || removed.length || failed.length) changed = true;
    personas.push({ name: u.name, added, removed, failed });
  }

  return { configured: true, changed, personas };
}
