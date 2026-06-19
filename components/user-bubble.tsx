// User message bubble in the end-user conversation stream (SID-62). Right-aligned
// quiet surface (SID-67: a warm elevated tone, not the old solid brand bubble) —
// the chat asymmetry stays (user = right bubble, agent = OutcomeCard) but the
// register is calm, leaving boldness for the reasoning trace.
export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end motion-safe:animate-[fadeIn_200ms_ease-out]">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-lg border border-border bg-background-tertiary px-md py-sm text-text-primary">
        {text}
      </p>
    </div>
  );
}
