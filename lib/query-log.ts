// SID-80: persist real visitor queries to Turso (libSQL) so they can be compared
// against the synthetic eval set as a validation channel. STORAGE ONLY — no read
// path in the app (read access is `turso db shell cleared` from the laptop).
//
// Fire-and-forget: logQuery() never throws and never blocks the diagnose response.
// It's invoked via Next.js `after()` at the call site, so the insert runs after the
// response is flushed. A missing/failed config is a no-op (logged once), mirroring
// the source adapters that fall back silently when their token isn't set — the
// diagnose path must not get slower or less reliable because of logging.

import { createClient, type Client } from "@libsql/client";

const URL = process.env.TURSO_DATABASE_URL;
const TOKEN = process.env.TURSO_AUTH_TOKEN;

// Lazy singleton — built once per process on first use, reused after. Null when
// unconfigured (e.g. local dev without Turso, or the eval workspace), which makes
// logQuery a clean no-op instead of a failure.
let client: Client | null | undefined;

function getClient(): Client | null {
  if (client !== undefined) return client;
  if (!URL || !TOKEN) {
    console.warn("[query-log] Turso not configured — query logging disabled.");
    client = null;
    return client;
  }
  client = createClient({ url: URL, authToken: TOKEN });
  return client;
}

export type QueryLogEntry = {
  ticket_id: string;
  message: string;
  verdict?: string | null;
  role?: "user" | "system";
};

// Insert one row. Resolves regardless of outcome — failures are logged server-side
// and swallowed so a logging outage can never surface to the user or break diagnose.
export async function logQuery(entry: QueryLogEntry): Promise<void> {
  const db = getClient();
  if (!db) return;
  try {
    await db.execute({
      sql: `INSERT INTO query_log (timestamp, ticket_id, role, message, verdict)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        new Date().toISOString(), // ISO 8601, UTC
        entry.ticket_id,
        entry.role ?? "user",
        entry.message,
        entry.verdict ?? null,
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[query-log] insert failed:", message);
  }
}
