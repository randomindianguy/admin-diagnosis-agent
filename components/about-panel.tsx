"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// SID-76: the "about this demo" modal — reframes the live product as a portfolio
// piece. Visual register matches the SID-71 walkthrough panel EXACTLY (warm surface
// bg-background-secondary, hairline border, no shadow; mono eyebrow + Newsreader
// title + Inter body; amber outline links). Built as a real dialog (none existed):
// role="dialog" + aria-modal, ESC / overlay / X to close, focus moved in on open
// and restored on close.

const REPO_URL = "https://github.com/randomindianguy/admin-diagnosis-agent";
const PORTFOLIO_URL = "https://sidharthsundaram.com/";
const LINKEDIN_URL = "https://www.linkedin.com/in/sidharthsundaram/";

// Verbatim from the SID-76 card. Paragraph 3 is the sharpened rewrite (Sid's call);
// 1, 2, 4 are the card copy as written.
const PARAGRAPHS = [
  "Cleared is a portfolio demo by Sid Sundaram — a B2B SaaS PM transitioning into AI-native PM work. It's built around a single architectural thesis: in high-trust enterprise contexts, the agent should refuse when its evidence is insufficient, rather than guess.",
  "I chose workspace access triage as the domain because it surfaces every architectural trade-off this thesis requires — real workspace state as reasoning input (Okta, Notion, Slack), verifiable writes when an admin approves, refuse-first behavior when symptoms are ambiguous. The artifact runs against real workspaces with real APIs; the Okta writes are real.",
  "The architecture isn't really about access. It's about gating confident wrongness in agentic systems. That pattern travels to anywhere the cost of being confidently wrong exceeds the cost of refusing.",
  "I'm currently a 2nd-year MS Engineering Management student at Purdue (graduating May 2027), pursuing AI PM roles.",
];

const LINKS = [
  { label: "SOURCE", text: "github.com/randomindianguy/admin-diagnosis-agent", href: REPO_URL },
  { label: "PORTFOLIO", text: "sidharthsundaram.com", href: PORTFOLIO_URL },
  { label: "LINKEDIN", text: "https://www.linkedin.com/in/sidharthsundaram/", href: LINKEDIN_URL },
];

export function AboutPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // ESC to close + move focus into the dialog on open, restore it on close.
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      // Overlay matches the walkthrough's #0F0E0C @ 0.85. Click outside → close.
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f0e0c]/85 p-md motion-safe:animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[85vh] w-full max-w-[420px] overflow-auto rounded-lg border border-border bg-background-secondary p-lg text-text-primary"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-md top-md inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:text-text-primary"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-text-muted">
              About this demo
            </span>
            <h2
              id="about-title"
              className="font-display text-[22px] font-medium leading-[1.2] text-text-primary [text-wrap:balance]"
            >
              A portfolio piece, not a product.
            </h2>
          </div>

          <div className="flex flex-col gap-sm">
            {PARAGRAPHS.map((p, i) => (
              <p key={i} className="text-[14px] leading-[1.5] text-text-primary [text-wrap:pretty]">
                {p}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-xs border-t border-border pt-md">
            {LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-baseline gap-sm text-[14px]"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
                  {l.label}
                </span>
                <span className="text-text-muted" aria-hidden>
                  →
                </span>
                <span className="text-accent underline-offset-2 group-hover:underline">
                  {l.text}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
