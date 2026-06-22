// Reset ALL demo personas to their seeded Okta group memberships (SID-72).
// scenario.json's status_picture.users is canonical — read at runtime so future
// scenario edits need no script change. For each persona: diff current Okta
// memberships against the seed, add what's missing, remove what's extra. Idempotent
// (a clean run reports "no change"). Run between demos so reviewer experiments
// (submit → approve, which writes a real group grant) don't pollute across runs.
//
// Run: node --env-file=.env.local scripts/reset-demo.mts

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getOktaPicture,
  addUserToGroup,
  removeUserFromGroup,
} from "../lib/sources/okta.ts";

type SeedUser = {
  id: string;
  name: string;
  direct_group_memberships: string[];
};

const scenario = JSON.parse(
  readFileSync(join(process.cwd(), "scenario.json"), "utf8"),
) as { setup: { status_picture: { users: SeedUser[] } } };
const desired = scenario.setup.status_picture.users;

const picture = await getOktaPicture();
if (!picture) {
  console.error("Okta is not configured (OKTA_DOMAIN / OKTA_API_TOKEN missing).");
  process.exit(1);
}
const currentById = new Map(
  picture.users.map((u) => [u.id, new Set(u.direct_group_memberships)]),
);

const short = (g: string) => g.replace(/^group:/, "");
let changedAny = false;

for (const u of desired) {
  const want = new Set(u.direct_group_memberships);
  const have = currentById.get(u.id) ?? new Set<string>();
  const toAdd = [...want].filter((g) => !have.has(g));
  const toRemove = [...have].filter((g) => !want.has(g));

  if (toAdd.length === 0 && toRemove.length === 0) {
    console.log(`  ${u.name}: no change`);
    continue;
  }
  changedAny = true;
  const notes: string[] = [];
  for (const g of toAdd) {
    const r = await addUserToGroup(u.id, g);
    notes.push(r.ok ? `+${short(g)}` : `+${short(g)} FAILED (${r.error})`);
  }
  for (const g of toRemove) {
    const r = await removeUserFromGroup(u.id, g);
    notes.push(r.ok ? `-${short(g)}` : `-${short(g)} FAILED (${r.error})`);
  }
  console.log(`  ${u.name}: ${notes.join(", ")}`);
}

console.log(changedAny ? "Reset complete." : "All personas already at seeded state.");
