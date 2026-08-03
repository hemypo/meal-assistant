/**
 * One place every server-side failure is reported.
 *
 * Today this writes a structured line that Vercel's runtime logs pick up and
 * can alert on. It exists as a single seam so wiring Sentry later is a change
 * in this file only — rather than hunting scattered console.error calls.
 *
 * Deliberately NOT using @sentry/nextjs yet: it needs an account and DSN
 * (founder credentials), and it ships a build-time plugin whose behaviour on
 * Next 16 + Turbopack is unverified. See CLAUDE.md §7.
 */

type Scope =
  | "ai"
  | "receipts"
  | "recipes"
  | "products"
  | "settings"
  | "cron"
  | "route";

/** Never let a message carry a key, token or connection string into logs. */
function sanitise(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[connection-string]")
    .replace(/\b(?:AIza|sk-|gho_|vercel_blob_rw_)[A-Za-z0-9_\-]{10,}/g, "[redacted]");
}

export function reportError(scope: Scope, error: unknown, context?: string) {
  const message =
    error instanceof Error ? error.message : "non-error thrown";

  // Structured so it can be filtered in Vercel logs and later mapped to Sentry.
  console.error(
    JSON.stringify({
      level: "error",
      scope,
      context,
      message: sanitise(message),
      // The stack stays server-side; it is never returned to the client.
      stack: error instanceof Error ? sanitise(error.stack ?? "") : undefined,
    }),
  );
}
