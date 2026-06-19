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

  // Members per group → re-keyed memberships per user.
  const userMemberships = new Map<string, Set<string>>(); // userOktaId → group:<name>
  const userMeta = new Map<string, UserRaw>();
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
