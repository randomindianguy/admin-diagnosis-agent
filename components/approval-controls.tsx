"use client";

import { useState } from "react";
import { useSubmissions, type Submission } from "@/lib/store";
import type { ApprovalAction } from "@/lib/schema";

// Admin Approve/Deny for an add_to_group escalate (SID-70). Approve POSTs the
// re-keyed action to /api/approve, which does the real Okta write; the submission
// advances to `approved` ONLY on a confirmed 200 — a failure leaves it pending and
// shows the reason (no half-state). Deny is a local state change (no Okta write).
export function ApprovalControls({
  submission,
  action,
}: {
  submission: Submission;
  action: Extract<ApprovalAction, { type: "add_to_group" }>;
}) {
  const approveSubmission = useSubmissions((s) => s.approveSubmission);
  const denySubmission = useSubmissions((s) => s.denySubmission);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (submission.status === "approved") {
    return (
      <p className="text-sm text-verdict-resolve">
        ✓ Approved by you · just now
      </p>
    );
  }
  if (submission.status === "denied") {
    return <p className="text-sm text-text-muted">Denied by you · just now</p>;
  }

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: action.user_id,
          group_id: action.group_id,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Approval failed (HTTP ${res.status}).`);
        return; // stays pending_approval — no half-state
      }
      approveSubmission(submission.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-sm rounded-md border border-border bg-background-secondary px-md py-md">
      <p className="text-sm text-text-muted">
        Recommended action — add{" "}
        <span className="text-text-primary">{submission.requester.name}</span> to{" "}
        <span className="font-mono text-monoValue text-text-primary">
          {action.group_name}
        </span>
      </p>
      <div className="flex items-center gap-sm">
        <button
          type="button"
          onClick={approve}
          disabled={busy}
          className="inline-flex min-h-[40px] items-center justify-center rounded-md bg-accent px-lg py-xs font-medium text-background-primary transition-opacity disabled:opacity-50"
        >
          {busy ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => denySubmission(submission.id)}
          disabled={busy}
          className="inline-flex min-h-[40px] items-center justify-center rounded-md border border-border px-lg py-xs text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
        >
          Deny
        </button>
      </div>
      {error && (
        <p className="text-sm text-verdict-escalate">Approval failed — {error}</p>
      )}
    </div>
  );
}
