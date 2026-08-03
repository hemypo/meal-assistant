import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

/**
 * Neon's free tier suspends the compute after inactivity, and the first
 * request afterwards fails before the wake-up finishes — reproduced many times
 * in development. Builds are already protected by scripts/migrate-deploy.mjs;
 * this covers *runtime*, so the first page load after a quiet spell doesn't
 * greet the user with an error.
 *
 * Only errors raised BEFORE the query could execute are retried:
 *   P1001 — cannot reach the database server (no connection established)
 *   P2024 — timed out fetching a connection from the pool
 * Anything ambiguous (e.g. a connection dropped mid-statement) is rethrown,
 * because retrying it could double-apply a write.
 */
const RETRYABLE_CODES = new Set(["P1001", "P2024"]);
const RETRY_DELAY_MS = 1500;
const MAX_ATTEMPTS = 3;

export function isColdStart(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" && RETRYABLE_CODES.has(code);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createClient() {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!,
  });

  return new PrismaClient({ adapter }).$extends({
    query: {
      async $allOperations({ args, query }) {
        for (let attempt = 1; ; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            if (attempt >= MAX_ATTEMPTS || !isColdStart(error)) throw error;
            await sleep(RETRY_DELAY_MS);
          }
        }
      },
    },
  });
}

type ExtendedPrisma = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrisma };

export const prisma: ExtendedPrisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
