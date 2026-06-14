"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Copy-to-clipboard with inline confirmation (SID-48 A.3). Feedback stays in the
// button — text flips to "Copied" for ~1.5s, no toast. The copied text is the
// real artifact an admin would paste into a ticket / Slack (recommend-with-handoff
// — the honest demo action; never a fake "Apply fix").
export function CopyButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — fail quietly; the demo
      // never depends on this for correctness.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-xs self-start rounded-pill border border-border px-md py-xs text-text-secondary transition-colors hover:text-text-primary"
    >
      {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}
