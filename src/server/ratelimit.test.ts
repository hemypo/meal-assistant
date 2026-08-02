import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimit } from "./ratelimit";

beforeEach(() => resetRateLimit());

describe("AI rate limiter", () => {
  it("allows requests up to the weight budget", () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit("u1", 1, now).ok).toBe(true);
    }
  });

  it("blocks the request that would exceed the budget", () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) checkRateLimit("u1", 1, now);

    const blocked = checkRateLimit("u1", 1, now);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("counts heavier tasks against the budget proportionally", () => {
    const now = Date.now();
    // Bulk parse costs 3; six of them exhaust an 18/20 budget.
    for (let i = 0; i < 6; i++) {
      expect(checkRateLimit("u1", 3, now).ok).toBe(true);
    }
    expect(checkRateLimit("u1", 3, now).ok).toBe(false);
  });

  it("isolates users from each other", () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) checkRateLimit("u1", 1, now);

    expect(checkRateLimit("u1", 1, now).ok).toBe(false);
    expect(checkRateLimit("u2", 1, now).ok).toBe(true);
  });

  it("frees the budget once the window has passed", () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) checkRateLimit("u1", 1, now);
    expect(checkRateLimit("u1", 1, now).ok).toBe(false);

    expect(checkRateLimit("u1", 1, now + 61_000).ok).toBe(true);
  });
});
