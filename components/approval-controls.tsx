"use client";

import { useCallback, useRef, useState } from "react";
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

  // SID-73: sticky-bottom action bar. The bar pins while a long ticket scrolls so
  // Approve/Deny stay reachable; its chrome (hairline + warm surface) appears ONLY
  // when actually pinned, so short tickets are visually unchanged. A sentinel just
  // below the bar — observed against the nearest scroll container — tells us whether
  // the bar is pinned (sentinel scrolled out of view) or at rest (sentinel visible).
  // Callback ref so the observer attaches exactly when the sentinel mounts, robust
  // across the conditional renders below.
  const [stuck, setStuck] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!node) return;
    let root: HTMLElement | null = node.parentElement;
    while (root) {
      const oy = getComputedStyle(root).overflowY;
      if (oy === "auto" || oy === "scroll") break;
      root = root.parentElement;
    }
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { root, threshold: 0 },
    );
    io.observe(node);
    observerRef.current = io;
  }, []);

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
    <>
      {/* Sticky bar: pins to the scroll-container bottom on long tickets. Chrome
          (border-top + warm surface) is gated on `stuck` so short tickets — where
          the bar rests in normal flow — render exactly as before. No shadow. */}
      <div
        className={`sticky bottom-0 z-10 border-t ${
          stuck
            ? "border-border bg-background-secondary pt-md"
            : "border-transparent"
        }`}
      >
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
      </div>
      {/* Sentinel at the bar's natural-flow bottom — out of view ⇒ bar is pinned. */}
      <div ref={sentinelRef} aria-hidden className="h-px" />
    </>
  );
}
