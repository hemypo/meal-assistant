import { describe, expect, it, vi } from "vitest";

// db.ts constructs a Prisma client at import time; the adapter must not try to
// reach a real database just to test the retry predicate.
vi.mock("@prisma/adapter-neon", () => ({ PrismaNeon: class {} }));
vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: class {
    $extends() {
      return this;
    }
  },
}));

const { isColdStart } = await import("./db");

describe("cold-start retry predicate", () => {
  it("retries when the server could not be reached at all", () => {
    // Neon's compute was suspended — no connection, so no query ran.
    expect(isColdStart({ code: "P1001" })).toBe(true);
  });

  it("retries a connection-pool timeout", () => {
    expect(isColdStart({ code: "P2024" })).toBe(true);
  });

  it("does NOT retry a unique-constraint violation", () => {
    expect(isColdStart({ code: "P2002" })).toBe(false);
  });

  it("does NOT retry a transaction timeout", () => {
    // P2028 means the transaction started; replaying it could double-apply.
    expect(isColdStart({ code: "P2028" })).toBe(false);
  });

  it("does NOT retry an error with no Prisma code", () => {
    expect(isColdStart(new Error("Connection terminated unexpectedly"))).toBe(
      false,
    );
    expect(isColdStart(undefined)).toBe(false);
    expect(isColdStart({ code: 42 })).toBe(false);
  });
});
