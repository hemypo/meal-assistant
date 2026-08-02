import { spawnSync } from "node:child_process";

/**
 * `prisma migrate deploy` with retries.
 *
 * Neon's free tier auto-suspends the compute after inactivity, and the first
 * connection after that reliably fails with P1001 before the wake-up
 * completes. Since every Vercel build runs migrations first, one cold database
 * would otherwise fail the whole deploy. Observed repeatedly in development.
 */
const ATTEMPTS = 4;
const DELAY_MS = 5000;

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    shell: true,
  });

  if (result.status === 0) process.exit(0);

  if (attempt < ATTEMPTS) {
    console.log(
      `migrate deploy failed (attempt ${attempt}/${ATTEMPTS}) — database may be waking, retrying in ${DELAY_MS / 1000}s`,
    );
    sleep(DELAY_MS);
  }
}

console.error("migrate deploy failed after all attempts");
process.exit(1);
