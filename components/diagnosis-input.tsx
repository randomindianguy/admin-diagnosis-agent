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
        aria-label="Describe the access problem you're having"
        placeholder={"Describe what you're trying to open and what's happening — e.g. “I can't open the Q3 revenue folder”"}
        className="w-full resize-none rounded-md border border-border bg-background-primary p-md text-body text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none disabled:opacity-50"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-accent px-lg py-sm font-medium text-background-primary transition-opacity disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </section>
  );
}
