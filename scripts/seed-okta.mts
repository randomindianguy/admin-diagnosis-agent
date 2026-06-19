// Seed the Okta dev org with the Acme identity graph from scenario.json (SID-61).
// Real Okta Management API calls (SSWS token). Idempotent: find-or-create.
//
// Nested groups: Okta groups are flat, so the parent relationship is encoded on
// the subgroup. We TRY a custom group-profile attribute `parent_group`; if the
// org can't extend the group schema (e.g. no Identity Governance), we FALL BACK
// to encoding `parent_group:<name>` in the group description. fetchStatus()
// reconstructs the nesting from whichever is present.
//
// Run: node --env-file=.env.local scripts/seed-okta.mts

import { readFileSync } from "node:fs";
import { join } from "node:path";

const DOMAIN = process.env.OKTA_DOMAIN!;
const TOKEN = process.env.OKTA_API_TOKEN!;
const BASE = `https://${DOMAIN}/api/v1`;
const EMAIL_DOMAIN = "cleared-demo.example";

if (!DOMAIN || !TOKEN) throw new Error("OKTA_DOMAIN / OKTA_API_TOKEN missing");

async function okta(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `SSWS ${TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

// --- Load the identity graph from scenario.json (single source of truth) -------
type SGroup = { id: string; name: string; parent?: string };
type SUser = { id: string; name: string; direct_group_memberships: string[] };
const scenario = JSON.parse(
  readFileSync(join(process.cwd(), "scenario.json"), "utf8"),
) as { setup: { status_picture: { users: SUser[]; groups: SGroup[] } } };
const groups = scenario.setup.status_picture.groups;
const users = scenario.setup.status_picture.users;
const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

// --- Step 1: try to extend the group schema with `parent_group` ----------------
async function tryExtendGroupSchema(): Promise<boolean> {
  const res = await okta("POST", "/meta/schemas/group/default", {
    definitions: {
      custom: {
        id: "#custom",
        type: "object",
        properties: {
          parent_group: {
            title: "Parent group",
            description: "Name of the parent group this group is nested under",
            type: "string",
          },
        },
        required: [],
      },
    },
  });
  if (res.status >= 200 && res.status < 300) return true;
  console.warn(
    `  ↳ group-schema extension unavailable (HTTP ${res.status}: ${res.json?.errorSummary ?? "?"}). Falling back to description.`,
  );
  return false;
}

// --- Step 2: find-or-create a group, setting the parent relationship ----------
async function ensureGroup(
  name: string,
  parentName: string | undefined,
  useCustomAttr: boolean,
): Promise<string> {
  const found = await okta("GET", `/groups?q=${encodeURIComponent(name)}`);
  const existing = (found.json as any[]).find((g) => g.profile?.name === name);
  const profile: Record<string, string> = { name };
  if (parentName) {
    if (useCustomAttr) profile.parent_group = parentName;
    else profile.description = `parent_group:${parentName}`;
  }
  if (existing) {
    await okta("PUT", `/groups/${existing.id}`, { profile });
    return existing.id;
  }
  const created = await okta("POST", "/groups", { profile });
  if (created.status >= 300)
    throw new Error(`create group ${name}: ${JSON.stringify(created.json)}`);
  return created.json.id;
}

// --- Step 3: find-or-create a user (staged; we never log in) -------------------
async function ensureUser(name: string, id: string): Promise<string> {
  const local = id.replace(/^user:/, ""); // "maya.r"
  const login = `${local}@${EMAIL_DOMAIN}`;
  const [firstName, ...rest] = name.split(/\s+/);
  const lastName = rest.join(" ") || firstName;
  const found = await okta(
    "GET",
    `/users?search=${encodeURIComponent(`profile.login eq "${login}"`)}`,
  );
  if (Array.isArray(found.json) && found.json.length > 0) return found.json[0].id;
  const created = await okta("POST", "/users?activate=false", {
    profile: { firstName, lastName, email: login, login },
  });
  if (created.status >= 300)
    throw new Error(`create user ${name}: ${JSON.stringify(created.json)}`);
  return created.json.id;
}

async function main() {
  console.log(`Seeding Okta org ${DOMAIN}…`);

  const useCustomAttr = await tryExtendGroupSchema();
  console.log(
    `Parent relationship via: ${useCustomAttr ? "custom group attribute `parent_group`" : "group description"}`,
  );

  // Groups
  const groupIdByName = new Map<string, string>();
  for (const g of groups) {
    const parentName = g.parent ? groupNameById.get(g.parent) : undefined;
    const oktaId = await ensureGroup(g.name, parentName, useCustomAttr);
    groupIdByName.set(g.name, oktaId);
    console.log(
      `  group ${g.name}${parentName ? ` (parent: ${parentName})` : ""} → ${oktaId}`,
    );
  }

  // Users + memberships
  for (const u of users) {
    const oktaUserId = await ensureUser(u.name, u.id);
    console.log(`  user ${u.name} → ${oktaUserId}`);
    for (const gm of u.direct_group_memberships) {
      const gname = groupNameById.get(gm)!;
      const gid = groupIdByName.get(gname)!;
      const r = await okta("PUT", `/groups/${gid}/users/${oktaUserId}`);
      console.log(
        `    member of ${gname}: ${r.status < 300 ? "ok" : `FAILED ${r.status}`}`,
      );
    }
  }

  console.log("Okta seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
