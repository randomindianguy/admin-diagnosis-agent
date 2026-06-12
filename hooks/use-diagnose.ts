"use client";

import { useMutation } from "@tanstack/react-query";
import type { DiagnosisOutput } from "@/lib/schema";

// POST the symptom to /api/diagnose. On a non-2xx, surface the {error} message
// from the body (Q16's error channel) so the UI's error state can display it.
async function postDiagnose(symptom: string): Promise<DiagnosisOutput> {
  const res = await fetch("/api/diagnose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symptom }),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // body wasn't JSON — keep the status-based message
    }
    throw new Error(message);
  }
  return (await res.json()) as DiagnosisOutput;
}

// TanStack mutation wrapper (Q6/Q15). The blocking request lifecycle —
// pending / error / success — drives the UI's loading / error / output states.
export function useDiagnose() {
  return useMutation<DiagnosisOutput, Error, string>({
    mutationFn: postDiagnose,
  });
}
