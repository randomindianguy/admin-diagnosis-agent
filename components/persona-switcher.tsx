"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Requester } from "@/lib/store";

// Persona switcher (SID-68) — top of the end-user left rail. A demo affordance,
// deliberately quiet: the current persona reads as identity (avatar + name in
// display serif + role in mono), and a click opens a plain dropdown of the five
// existing personas. Selecting one swaps the rail + clears the right pane. Uses
// only SID-67 tokens — no new visual register.

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function PersonaSwitcher({
  personas,
  current,
  onSelect,
}: {
  personas: Requester[];
  current: Requester;
  onSelect: (p: Requester) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-sm rounded-md px-sm py-xs text-left transition-colors hover:bg-background-secondary"
      >
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background-secondary text-sm font-bold text-text-secondary"
        >
          {initials(current.name)}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-display text-[17px] font-medium tracking-display text-text-primary">
            {current.name}
          </span>
          <span className="truncate font-mono text-monoLabel uppercase tracking-monoLabel text-text-muted">
            {current.role}
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`ml-auto shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Switch persona"
          className="absolute inset-x-0 top-[calc(100%+4px)] z-30 flex flex-col rounded-md border border-border bg-background-secondary p-[4px] shadow-xl"
        >
          {personas.map((p) => {
            const active = p.name === current.name;
            return (
              <li key={p.name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-sm rounded-sm px-sm py-xs text-left transition-colors hover:bg-background-tertiary ${active ? "bg-background-tertiary" : ""}`}
                >
                  <span
                    aria-hidden
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background-tertiary text-[10px] font-bold text-text-secondary"
                  >
                    {initials(p.name)}
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm text-text-primary">{p.name}</span>
                    <span className="truncate text-xs text-text-muted">
                      {p.role} · {p.team}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
