// Error state (Q16: errors are a separate channel from DiagnosisOutput — a crash
// is never an escalation card). Renders the {error: string} message from a
// non-2xx response, with a retry. Copy is a content draft (post-write review).
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <section className="flex flex-col gap-sm rounded-lg border border-border bg-background-secondary p-lg">
      <p className="text-text-primary">Something went wrong while diagnosing.</p>
      {message && <p className="text-text-secondary">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="self-start rounded-pill bg-brand-primary px-lg py-sm text-button text-text-inverse"
        >
          Try again
        </button>
      )}
    </section>
  );
}
