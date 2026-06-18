// User message bubble in the end-user conversation stream (SID-62). Right-aligned
// solid brand bubble — the same treatment the admin two-pane already uses for the
// submitted message, so the system reads coherently: user = solid right bubble,
// agent = OutcomeCard (the classic chat asymmetry).
export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end motion-safe:animate-[fadeIn_200ms_ease-out]">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-brand-primary px-md py-sm text-text-inverse">
        {text}
      </p>
    </div>
  );
}
