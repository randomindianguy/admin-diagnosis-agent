// Thin CLI wrapper (SID-74) around resetAllPersonas() — the SAME logic the
// /api/reset cron endpoint runs. Logs a human-readable per-persona diff. Run
// between demos so reviewer experiments (submit → approve, a real group grant)
// don't pollute across runs; the hourly Vercel cron does this automatically.
//
// Run: node --env-file=.env.local scripts/reset-demo.mts

import { resetAllPersonas } from "../lib/reset-personas.ts";

const result = await resetAllPersonas();

if (!result.configured) {
  console.error("Okta is not configured (OKTA_DOMAIN / OKTA_API_TOKEN missing).");
  process.exit(1);
}

for (const p of result.personas) {
  const notes = [
    ...p.added.map((g) => `+${g}`),
    ...p.removed.map((g) => `-${g}`),
    ...p.failed.map((f) => `${f} FAILED`),
  ];
  console.log(`  ${p.name}: ${notes.length ? notes.join(", ") : "no change"}`);
}

console.log(
  result.changed ? "Reset complete." : "All personas already at seeded state.",
);
