import { prisma } from "@/lib/db";
import { toRecipeDTO, type RecipeDTO } from "@/server/recipes";
import type { CreateMealEntryInput } from "@/lib/validation/recipe";
import type { MealType } from "@/generated/prisma/enums";

export type MealEntryDTO = {
  id: string;
  /** YYYY-MM-DD — never a weekday name (CLAUDE.md §4). */
  date: string;
  mealType: MealType;
  recipe: RecipeDTO;
};

/**
 * `@db.Date` columns come back as a UTC-midnight Date. Formatting with local
 * getters would shift the day for anyone behind UTC, so read UTC parts.
 */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parse YYYY-MM-DD as UTC midnight, matching how Postgres stores @db.Date. */
export function fromIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export async function listMealPlan(
  userId: string,
  from: string,
  to: string,
): Promise<MealEntryDTO[]> {
  const entries = await prisma.mealPlanEntry.findMany({
    where: { userId, date: { gte: fromIsoDate(from), lte: fromIsoDate(to) } },
    include: { recipe: { include: { ingredients: true } } },
    orderBy: [{ date: "asc" }, { mealType: "asc" }],
  });

  return entries.map((entry) => ({
    id: entry.id,
    date: toIsoDate(entry.date),
    mealType: entry.mealType,
    recipe: toRecipeDTO(entry.recipe),
  }));
}

export async function addMealEntry(
  userId: string,
  input: CreateMealEntryInput,
): Promise<MealEntryDTO | null> {
  // Scope the recipe lookup by userId so another user's recipe cannot be
  // scheduled by guessing its id.
  const recipe = await prisma.recipe.findFirst({
    where: { id: input.recipeId, userId },
    include: { ingredients: true },
  });
  if (!recipe) return null;

  const entry = await prisma.mealPlanEntry.upsert({
    where: {
      userId_date_mealType_recipeId: {
        userId,
        date: fromIsoDate(input.date),
        mealType: input.mealType,
        recipeId: input.recipeId,
      },
    },
    create: {
      userId,
      date: fromIsoDate(input.date),
      mealType: input.mealType,
      recipeId: input.recipeId,
    },
    update: {},
  });

  return {
    id: entry.id,
    date: toIsoDate(entry.date),
    mealType: entry.mealType,
    recipe: toRecipeDTO(recipe),
  };
}

export async function deleteMealEntry(
  userId: string,
  id: string,
): Promise<boolean> {
  const { count } = await prisma.mealPlanEntry.deleteMany({
    where: { id, userId },
  });
  return count > 0;
}
