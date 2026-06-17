"use client";

// Pure input: textarea + send. Scenario chips moved up into the left pane under
// the greeting (SID-48 Phase 1.2) — this component is just the entry control now.
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
    <section className="flex flex-col gap-sm">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={3}
        placeholder="What are you trying to access, and what's happening when you try?"
        className="w-full resize-none rounded-md border border-border bg-background-primary p-md text-body text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none disabled:opacity-50"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="rounded-pill bg-brand-primary px-lg py-sm text-button text-text-inverse transition-opacity disabled:opacity-40"
        >
          Check access
        </button>
      </div>
    </section>
  );
}
