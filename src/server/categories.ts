import { prisma } from "@/lib/db";
import { runTask } from "@/lib/ai/tasks";
import { CATEGORIES } from "@/lib/utils";

const DEFAULT_CATEGORY = "Другое";

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function isKnownCategory(value: string): boolean {
  return (CATEGORIES as readonly string[]).includes(value);
}

/**
 * Resolve categories for a batch of product names, cache-first
 * (master plan §6.5): a name is classified by AI once per lifetime, then
 * served from Postgres. N products => at most 1 AI call, and 0 on a full hit.
 */
export async function resolveCategories(
  userId: string,
  names: string[],
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();

  const unique = [...new Set(names.map(normalizeName))].filter(Boolean);
  if (unique.length === 0) return resolved;

  // Both the user's own mappings and the shared/global ones (userId null).
  const cached = await prisma.categoryMapping.findMany({
    where: { normalizedName: { in: unique }, OR: [{ userId }, { userId: null }] },
  });

  for (const row of cached) {
    // A user-specific mapping wins over a global one for the same name.
    if (row.userId === userId || !resolved.has(row.normalizedName)) {
      resolved.set(row.normalizedName, row.category);
    }
  }

  const missing = unique.filter((n) => !resolved.has(n));
  if (missing.length === 0) return resolved;

  let classified: { name: string; category: string }[] = [];
  try {
    classified = await runTask("categorize", { names: missing });
  } catch {
    // AI unavailable is not fatal — fall back to the default category so the
    // user's products still save. They can correct the category by hand.
    for (const name of missing) resolved.set(name, DEFAULT_CATEGORY);
    return resolved;
  }

  const learned: { userId: string; normalizedName: string; category: string }[] =
    [];

  for (const item of classified) {
    const key = normalizeName(item.name);
    if (!missing.includes(key)) continue; // ignore names we did not ask about
    const category = isKnownCategory(item.category)
      ? item.category
      : DEFAULT_CATEGORY;
    resolved.set(key, category);
    learned.push({ userId, normalizedName: key, category });
  }

  // Anything the model silently skipped still needs a value.
  for (const name of missing) {
    if (!resolved.has(name)) resolved.set(name, DEFAULT_CATEGORY);
  }

  if (learned.length > 0) {
    await prisma.categoryMapping.createMany({
      data: learned,
      skipDuplicates: true,
    });
  }

  return resolved;
}
