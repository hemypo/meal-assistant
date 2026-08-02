/**
 * In-memory sliding-window limiter for /api/ai/* (master plan §6.5).
 *
 * Deliberately simple: single user, single region. It resets on cold start and
 * does not span serverless instances — acceptable for MVP, and the plan calls
 * for Upstash Redis if this ever serves real traffic.
 */

const WINDOW_MS = 60_000;
const MAX_WEIGHT_PER_WINDOW = 20;

type Entry = { weight: number; at: number };

const hits = new Map<string, Entry[]>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function checkRateLimit(
  userId: string,
  weight: number,
  now = Date.now(),
): RateLimitResult {
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(userId) ?? []).filter((e) => e.at > cutoff);

  const used = recent.reduce((sum, e) => sum + e.weight, 0);
  if (used + weight > MAX_WEIGHT_PER_WINDOW) {
    const oldest = recent[0]?.at ?? now;
    hits.set(userId, recent);
    return {
      ok: false,
      remaining: Math.max(0, MAX_WEIGHT_PER_WINDOW - used),
      retryAfterSec: Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)),
    };
  }

  recent.push({ weight, at: now });
  hits.set(userId, recent);
  return {
    ok: true,
    remaining: MAX_WEIGHT_PER_WINDOW - (used + weight),
    retryAfterSec: 0,
  };
}

/** Test seam only. */
export function resetRateLimit() {
  hits.clear();
}
