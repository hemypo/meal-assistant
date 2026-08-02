import { hash } from "@node-rs/argon2";
import { prisma } from "@/lib/db";
import type { CredentialsInput } from "@/lib/validation/auth";

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: "NOT_ALLOWED" | "ALREADY_EXISTS" | "NOT_CONFIGURED" };

/**
 * Single-user registration (CLAUDE.md §5): succeeds only when the email
 * matches ALLOWED_EMAIL exactly. The schema stays multi-user-ready.
 */
export async function registerUser({
  email,
  password,
}: CredentialsInput): Promise<RegisterResult> {
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!allowed) return { ok: false, error: "NOT_CONFIGURED" };
  if (email !== allowed) return { ok: false, error: "NOT_ALLOWED" };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "ALREADY_EXISTS" };

  await prisma.user.create({
    data: { email, passwordHash: await hash(password) },
  });

  return { ok: true };
}
