import { prisma } from "@/lib/db";

/** Master plan §9.2 step 4. */
export const ORPHAN_RECIPE_TTL_DAYS = 7;

/**
 * Deletes AI recipes the user never kept: not saved to «Мои рецепты», not
 * scheduled in the calendar, and older than the TTL. Manual recipes are never
 * touched — the user typed those, so they are theirs regardless of age.
 *
 * Runs for every user; the cron has no session, so this is one of the few
 * places without a userId filter. That is deliberate and safe because the
 * predicate itself cannot select anything a user still references.
 */
export async function cleanupOrphanRecipes(now = new Date()): Promise<number> {
  const cutoff = new Date(
    now.getTime() - ORPHAN_RECIPE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const { count } = await prisma.recipe.deleteMany({
    where: {
      source: "AI",
      isSaved: false,
      createdAt: { lt: cutoff },
      // `none` covers recipes that were scheduled and later unscheduled too.
      mealEntries: { none: {} },
    },
  });

  return count;
}
