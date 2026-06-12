import { NextResponse } from "next/server";
import { retrieveContext } from "@/lib/retrieval";
import { runGatedDiagnosis } from "@/lib/gate-signals";

// Retrieval reads the filesystem (reference-library/, scenario.json), so this
// route runs on the Node.js runtime, not edge.
export const runtime = "nodejs";

// POST /api/diagnose  —  body: { symptom: string }  →  DiagnosisOutput (Q4)
//
// Error contract (Q16): errors are a SEPARATE channel from DiagnosisOutput — a
// crash is never dressed up as an escalate (chunk-1 fail-loud, one altitude up).
//   400 → invalid input  |  500 → upstream/internal failure  |  200 → output
export async function POST(request: Request): Promise<Response> {
  // --- 400 guards, BEFORE the pipeline try/catch, so bad input can never be
  //     swallowed into the upstream-failure 500 path. ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const symptom = (body as { symptom?: unknown }).symptom;
  if (typeof symptom !== "string" || symptom.trim().length === 0) {
    return NextResponse.json(
      { error: "Field 'symptom' is required and must be a non-empty string." },
      { status: 400 },
    );
  }

  // --- Pipeline. The try wraps ONLY retrieve → gate, so its catch returns 500
  //     exclusively for upstream/internal failure — not for client input. ---
  try {
    const context = await retrieveContext(symptom);
    const output = await runGatedDiagnosis(symptom, context);
    return NextResponse.json(output, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown diagnosis error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
