// Reset the Demo User persona to its starting state — no group memberships
// (SID-70). Run between closed-loop demos so "ask → escalate → approve" works
// fresh each time. Idempotent. Run: node --env-file=.env.local scripts/reset-demo-user.mts

const DOMAIN = process.env.OKTA_DOMAIN!;
const TOKEN = process.env.OKTA_API_TOKEN!;
const BASE = `https://${DOMAIN}/api/v1`;
const LOGIN = "demo.user@cleared-demo.example";

if (!DOMAIN || !TOKEN) throw new Error("OKTA_DOMAIN / OKTA_API_TOKEN missing");

const headers = { Authorization: `SSWS ${TOKEN}`, Accept: "application/json" };

const userRes = await fetch(`${BASE}/users/${encodeURIComponent(LOGIN)}`, { headers });
if (!userRes.ok) throw new Error(`User lookup failed (${userRes.status})`);
const user = (await userRes.json()) as { id: string };

const groupsRes = await fetch(`${BASE}/users/${user.id}/groups`, { headers });
const groups = (await groupsRes.json()) as { id: string; profile: { name: string } }[];

let removed = 0;
for (const g of groups) {
  if (g.profile.name === "Everyone") continue; // built-in, can't remove
  const del = await fetch(`${BASE}/groups/${g.id}/users/${user.id}`, {
    method: "DELETE",
    headers,
  });
  console.log(`  remove from ${g.profile.name}: ${del.ok ? "ok" : `FAILED ${del.status}`}`);
  if (del.ok) removed++;
}
console.log(`Demo User reset — removed from ${removed} group(s).`);
