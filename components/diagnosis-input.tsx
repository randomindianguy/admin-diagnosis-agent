"use client";

// The canonical Seed-1 example. Per UI-SPEC Q2b the chip POPULATES the input
// (does not auto-submit) — the operator keeps control and presses Diagnose.
const SEED_1_SYMPTOM =
  "Maya on the data team can't open the 'Q3 Revenue Models' folder in Drive. She's in the data-team group, which I checked has access. Can you look?";

interface ExampleChip {
  label: string;
  query: string;
}

const CHIPS: ExampleChip[] = [
  { label: "Maya can't open Q3 Revenue Models", query: SEED_1_SYMPTOM },
];

interface DiagnosisInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function DiagnosisInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: DiagnosisInputProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter submits; Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  const canSubmit = !disabled && value.trim().length > 0;

  return (
    <section className="flex flex-col gap-md">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={3}
        placeholder="Describe the access issue…"
        className="w-full resize-none rounded-md border border-border bg-background-primary p-md text-body text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none disabled:opacity-50"
      />
      <div className="flex flex-wrap items-center justify-between gap-md">
        <div className="flex flex-wrap gap-sm">
          {CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onChange(chip.query)}
              disabled={disabled}
              className="rounded-pill bg-background-secondary px-md py-xs text-body text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="rounded-pill bg-surface-dark px-lg py-sm text-button text-text-inverse transition-opacity disabled:opacity-40"
        >
          Diagnose
        </button>
      </div>
    </section>
  );
}
