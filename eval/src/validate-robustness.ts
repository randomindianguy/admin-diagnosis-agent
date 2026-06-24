// SID-77 robustness runner — three NEW tiers added on top of the existing eval,
// touching no existing tier file (basics/nuance/scope-C all stand):
//   adversarial (10)  — single-turn bypass attempts
//   multi-turn  (8)   — stitched conversations (manual-stitch = the production path)
//   scope-clear (5)   — clear out-of-scope refusals
//
// Sibling-runner pattern (same as validate-scope.ts): chdir to project root, load
// the root .env.local, dynamic-import the UNCHANGED lib, call diagnose() directly
// (single-shot; bypasses gate-signals — the verdict boundary is a property of the
// model's tool choice, which the single call exercises).
//
// SUBJECT: scenario default current_user = alex.chen (analytics-team; has the
// analytics dashboard; lacks data-team, so the data warehouse + Q3 Revenue Models
// require provisioning). retrieveContext() is called with NO personaUserId, so the
// subject is alex.chen for every case — stable and reproducible.
//
// GRADING: binary per case — PASS iff verdict ∈ expected_verdicts. The discipline
// (every grader validated against a deliberately-bad output BEFORE being trusted)
// runs as PHASE 1: each case's grader is checked against a synthetic good output
// (must PASS) and the case's bad_verdict (must FAIL). If any grader fails to
// discriminate, the run aborts — an untrustworthy ruler can't measure anything.
//
// This runner MEASURES; it does not gate. Live failures are the product (where the
// refuse-first thesis holds under pressure and where it doesn't), reported per tier
// with full detail for root-cause classification. Exit code reflects ruler health
// only, never the pass rate.

import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../..");
// Load the ROOT .env.local by absolute path — robust to the invocation cwd
// (npm scripts run from eval/, so a bare ".env.local" would miss the root file).
dotenv.config({ path: resolve(projectRoot, ".env.local") });
process.chdir(projectRoot);

// Dynamic imports AFTER chdir — lib/retrieval.ts builds its paths from process.cwd().
const { retrieveContext } = (await import("../../lib/retrieval")) as {
  retrieveContext: (symptom: string, personaUserId?: string) => Promise<unknown>;
};
const { diagnose } = (await import("../../lib/diagnosis")) as {
  diagnose: (
    symptom: string,
    context: unknown,
    options?: { temperature?: number },
  ) => Promise<{ verdict: string; root_cause?: string; owner?: string; diagnosis_text?: string }>;
};

// --- Manifest shape ----------------------------------------------------------

interface Case {
  id: string;
  text: string;
  expected_verdicts: string[];
  bad_verdict: string;
  axis: string;
  rationale: string;
}
interface Manifest {
  _tier: string;
  cases: Case[];
}

const ROBUSTNESS_DIR = "agent-outputs/robustness";
const TIER_FILES = ["adversarial.json", "multiturn.json", "scope-clear.json"];

function loadManifest(file: string): Manifest {
  return JSON.parse(readFileSync(join(projectRoot, ROBUSTNESS_DIR, file), "utf8")) as Manifest;
}

// The grader, isolated so PHASE 1 can validate the SAME function the live run uses.
function grade(verdict: string, expected: string[]): boolean {
  return expected.includes(verdict);
}

interface Row {
  tier: string;
  id: string;
  axis: string;
  expected: string[];
  verdict: string;
  pass: boolean;
  detail: string;
  latencyMs: number;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function main(): Promise<void> {
  for (const key of ["ANTHROPIC_API_KEY", "VOYAGE_API_KEY"]) {
    if (!process.env[key]) {
      console.error(`${key} is not set. Add it to .env.local in the project root.`);
      process.exit(1);
    }
  }

  const tiers = TIER_FILES.map(loadManifest);

  // ── PHASE 1 — grader self-validation (no API) ──────────────────────────────
  // Each grader must PASS a synthetic good output and FAIL the case's bad_verdict.
  console.log("─ PHASE 1 — grader validation (synthetic good/bad; no API) ──────────────────");
  let rulerBroken = false;
  for (const tier of tiers) {
    for (const c of tier.cases) {
      const good = grade(c.expected_verdicts[0], c.expected_verdicts); // must be true
      const bad = grade(c.bad_verdict, c.expected_verdicts); // must be false
      const ok = good && !bad;
      if (!ok) {
        rulerBroken = true;
        console.log(
          `  [${tier._tier}/${c.id}] RULER BROKEN ✗  good(${c.expected_verdicts[0]})=${good}  bad(${c.bad_verdict})=${bad}`,
        );
      }
    }
  }
  if (rulerBroken) {
    console.log("\nGrader validation FAILED — a ruler does not discriminate. Fix the manifest before trusting any live result.");
    process.exit(1);
  }
  const totalCases = tiers.reduce((n, t) => n + t.cases.length, 0);
  console.log(`  All ${totalCases} graders discriminate (good→PASS, bad→FAIL). Rulers trusted.\n`);

  // ── PHASE 2 — live run ─────────────────────────────────────────────────────
  console.log("─ PHASE 2 — live run (alex.chen subject; single-shot diagnose) ──────────────");
  const rows: Row[] = [];
  const runStart = performance.now();

  for (const tier of tiers) {
    for (const c of tier.cases) {
      const context = await retrieveContext(c.text);
      const t0 = performance.now();
      const j = await diagnose(c.text, context);
      const latencyMs = performance.now() - t0;

      const pass = grade(j.verdict, c.expected_verdicts);
      const detail = [
        j.root_cause ? `root_cause=${j.root_cause}` : "",
        j.owner ? `owner=${j.owner}` : "",
        j.diagnosis_text ? `text="${j.diagnosis_text.replace(/\s+/g, " ").slice(0, 200)}"` : "",
      ]
        .filter(Boolean)
        .join("  ");

      rows.push({
        tier: tier._tier,
        id: c.id,
        axis: c.axis,
        expected: c.expected_verdicts,
        verdict: j.verdict,
        pass,
        detail,
        latencyMs,
      });
      console.log(
        `  [${c.id.padEnd(34)}] expected={${c.expected_verdicts.join("|")}}  got=${j.verdict.padEnd(20)} → ${pass ? "PASS" : "FAIL"}  (${latencyMs.toFixed(0)}ms)`,
      );
    }
  }
  const totalRunMs = performance.now() - runStart;

  // ── Per-tier scores ────────────────────────────────────────────────────────
  console.log("\n─ Per-tier scores ──────────────────────────────────────────────────────────");
  for (const tier of tiers) {
    const tierRows = rows.filter((r) => r.tier === tier._tier);
    const passed = tierRows.filter((r) => r.pass).length;
    console.log(`  ${tier._tier.padEnd(12)} ${passed}/${tierRows.length}`);
  }

  // ── Failures (full detail for root-cause classification) ───────────────────
  const failures = rows.filter((r) => !r.pass);
  if (failures.length) {
    console.log("\n─ Failures (classify each: grader-insufficient / prompt-insufficient / architectural-gap) ─");
    for (const r of failures) {
      console.log(`  [${r.tier}/${r.id}]  axis=${r.axis}`);
      console.log(`     expected={${r.expected.join("|")}}  got=${r.verdict}`);
      console.log(`     ${r.detail}`);
    }
  } else {
    console.log("\n  No failures across all tiers.");
  }

  // ── NFR ────────────────────────────────────────────────────────────────────
  const latencies = rows.map((r) => r.latencyMs);
  console.log("\n─ NFR ──────────────────────────────────────────────────────────────────────");
  console.log(`  total run: ${(totalRunMs / 1000).toFixed(1)}s   per-diagnose: min ${Math.min(...latencies).toFixed(0)}ms  median ${median(latencies).toFixed(0)}ms  max ${Math.max(...latencies).toFixed(0)}ms`);
  console.log(`  (single-shot: ${rows.length} Anthropic diagnose calls + ${rows.length} query embeds)`);

  console.log("\n─ Done — rulers healthy; pass rates above are the measurement, not a gate. ─");
  process.exit(0); // exit reflects ruler health (PHASE 1), never the pass rate
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
