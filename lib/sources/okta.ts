// Real Okta identity source for fetchStatus() (SID-61). Reads users, groups,
// memberships, and the `parent_group` custom attribute from the Okta dev org,
// then RE-KEYS them to the scenario.json id scheme ("group:<name>",
// "user:<login-local>") so the existing fetchStatus filtering + scenario.json
// resources work unchanged.
//
// Returns null when not configured (no token — e.g. the eval workspace) or on
// any error, which makes the caller fall back to synthetic data. The picture is
// memoized for the process lifetime (it doesn't change per request).

type OktaUser = { id: string; name: string; direct_group_memberships: string[] };
type OktaGroup = { id: string; name: string; parent?: string };
export type OktaPicture = { users: OktaUser[]; groups: OktaGroup[] };

type GroupRaw = {
  id: string;
  profile: { name: string; parent_group?: string; description?: string };
};
type UserRaw = {
  id: string;
  profile: { firstName: string; lastName: string; login: string };
};

const DOMAIN = process.env.OKTA_DOMAIN;
const TOKEN = process.env.OKTA_API_TOKEN;
// The login domain the seeder (scripts/seed-okta.mts) uses for all demo personas.
// Scoping the user fetch to it keeps the org's own admin account out of the picture.
const SEED_EMAIL_DOMAIN = "cleared-demo.example";

async function okta<T>(path: string): Promise<T> {
  const res = await fetch(`https://${DOMAIN}/api/v1${path}`, {
    headers: { Authorization: `SSWS ${TOKEN}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Okta ${path} → ${res.status}`);
  return (await res.json()) as T;
}

let cache: Promise<OktaPicture | null> | null = null;

export function getOktaPicture(): Promise<OktaPicture | null> {
  if (!DOMAIN || !TOKEN) return Promise.resolve(null); // not configured → synthetic
  if (!cache) cache = build().catch(() => null);
  return cache;
}

async function build(): Promise<OktaPicture> {
  const rawGroups = await okta<GroupRaw[]>("/groups?limit=200");
  // Skip Okta's built-in "Everyone" group — it isn't part of the access model.
  const managed = rawGroups.filter((g) => g.profile?.name !== "Everyone");

  const groups: OktaGroup[] = managed.map((g) => {
    // parent comes from the custom attribute, or `parent_group:<name>` encoded
    // in the description (the no-schema fallback used at seed time).
    let parentName = g.profile.parent_group;
    if (!parentName && typeof g.profile.description === "string") {
      const m = g.profile.description.match(/parent_group:(\S+)/);
      if (m) parentName = m[1];
    }
    return {
      id: `group:${g.profile.name}`,
      name: g.profile.name,
      parent: parentName ? `group:${parentName}` : undefined,
    };
  });

  // All demo users FIRST (SID-70), so zero-group identities like Demo User still
  // appear in the picture — the persona attribution needs them. Scoped to the
  // seed email domain so the org's own admin account doesn't leak in. Memberships
  // are layered on top from the group iteration.
  const userMemberships = new Map<string, Set<string>>(); // userOktaId → group:<name>
  const userMeta = new Map<string, UserRaw>();
  const allUsers = await okta<UserRaw[]>("/users?limit=200");
  for (const u of allUsers) {
    if (!u.profile?.login?.endsWith(`@${SEED_EMAIL_DOMAIN}`)) continue;
    userMemberships.set(u.id, new Set());
    userMeta.set(u.id, u);
  }
  for (const g of managed) {
    const members = await okta<UserRaw[]>(`/groups/${g.id}/users?limit=200`);
    for (const u of members) {
      if (!userMemberships.has(u.id)) {
        userMemberships.set(u.id, new Set());
        userMeta.set(u.id, u);
      }
      userMemberships.get(u.id)!.add(`group:${g.profile.name}`);
    }
  }

  const users: OktaUser[] = [...userMemberships.entries()].map(
    ([oktaId, groupSet]) => {
      const u = userMeta.get(oktaId)!;
      const name = `${u.profile.firstName} ${u.profile.lastName}`.trim();
      const local = u.profile.login.split("@")[0];
      return { id: `user:${local}`, name, direct_group_memberships: [...groupSet] };
    },
  );

  return { users, groups };
}

// SID-70: the closed-loop write. Resolves re-keyed ids ("user:<login-local>",
// "group:<name>") to real Okta ids, then adds the user to the group. Returns a
// result object (never throws) so the approve route can surface failures cleanly.
// Invalidates the memoized picture on success so a re-submit reflects the grant.
export async function addUserToGroup(
  userKeyId: string,
  groupKeyId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!DOMAIN || !TOKEN) return { ok: false, error: "Okta is not configured." };
  const headers = { Authorization: `SSWS ${TOKEN}`, Accept: "application/json" };
  try {
    const login = `${userKeyId.replace(/^user:/, "")}@${SEED_EMAIL_DOMAIN}`;
    const groupName = groupKeyId.replace(/^group:/, "");

    const userRes = await fetch(
      `https://${DOMAIN}/api/v1/users/${encodeURIComponent(login)}`,
      { headers },
    );
    if (!userRes.ok) {
      return { ok: false, error: `User lookup failed (HTTP ${userRes.status}).` };
    }
    const user = (await userRes.json()) as { id: string };

    const groupsRes = await fetch(
      `https://${DOMAIN}/api/v1/groups?q=${encodeURIComponent(groupName)}`,
      { headers },
    );
    if (!groupsRes.ok) {
      return { ok: false, error: `Group lookup failed (HTTP ${groupsRes.status}).` };
    }
    const groups = (await groupsRes.json()) as GroupRaw[];
    const group = groups.find((g) => g.profile?.name === groupName);
    if (!group) return { ok: false, error: `Group "${groupName}" not found in Okta.` };

    const putRes = await fetch(
      `https://${DOMAIN}/api/v1/groups/${group.id}/users/${user.id}`,
      { method: "PUT", headers },
    );
    if (!putRes.ok) {
      return { ok: false, error: `Okta group add failed (HTTP ${putRes.status}).` };
    }

    cache = null; // re-submit should see the new membership
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Okta write error." };
  }
}
