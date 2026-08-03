import { prisma } from "@/lib/db";
import { runTask } from "@/lib/ai/tasks";
import { normalizeName } from "@/server/categories";
import type { CreateRecipeInput } from "@/lib/validation/recipe";
import type { RecipeSource } from "@/generated/prisma/enums";

export type RecipeIngredientDTO = {
  id: string;
  name: string;
  amount: number;
  unit: string;
  wasInStock: boolean;
  estPrice: number | null;
};

export type RecipeDTO = {
  id: string;
  title: string;
  steps: string[];
  calories: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  cookTimeMin: number | null;
  source: RecipeSource;
  isSaved: boolean;
  ingredients: RecipeIngredientDTO[];
};

type Decimalish = { toString(): string };

function num(value: Decimalish | null): number | null {
  return value === null ? null : Number(value.toString());
}

/** `steps` is a Json column; guard against anything that is not string[]. */
function toSteps(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((s) => typeof s === "string") : [];
}

type RecipeRow = {
  id: string;
  title: string;
  steps: unknown;
  calories: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  cookTimeMin: number | null;
  source: RecipeSource;
  isSaved: boolean;
  ingredients: {
    id: string;
    name: string;
    amount: Decimalish;
    unit: string;
    wasInStock: boolean;
    estPrice: Decimalish | null;
  }[];
};

export function toRecipeDTO(recipe: RecipeRow): RecipeDTO {
  return {
    id: recipe.id,
    title: recipe.title,
    steps: toSteps(recipe.steps),
    calories: recipe.calories,
    proteinG: recipe.proteinG,
    fatG: recipe.fatG,
    carbsG: recipe.carbsG,
    cookTimeMin: recipe.cookTimeMin,
    source: recipe.source,
    isSaved: recipe.isSaved,
    ingredients: recipe.ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      amount: Number(i.amount.toString()),
      unit: i.unit,
      wasInStock: i.wasInStock,
      estPrice: num(i.estPrice),
    })),
  };
}

export async function listRecipes(
  userId: string,
  onlySaved: boolean,
): Promise<RecipeDTO[]> {
  const recipes = await prisma.recipe.findMany({
    where: { userId, ...(onlySaved ? { isSaved: true } : {}) },
    include: { ingredients: true },
    orderBy: { createdAt: "desc" },
  });
  return recipes.map(toRecipeDTO);
}

export async function getRecipe(
  userId: string,
  id: string,
): Promise<RecipeDTO | null> {
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId },
    include: { ingredients: true },
  });
  return recipe ? toRecipeDTO(recipe) : null;
}

export async function createRecipe(
  userId: string,
  input: CreateRecipeInput,
): Promise<RecipeDTO> {
  const recipe = await prisma.recipe.create({
    data: {
      userId,
      title: input.title,
      steps: input.steps,
      calories: input.calories ?? null,
      proteinG: input.proteinG ?? null,
      fatG: input.fatG ?? null,
      carbsG: input.carbsG ?? null,
      cookTimeMin: input.cookTimeMin ?? null,
      source: input.source,
      isSaved: input.isSaved,
      ingredients: {
        create: input.ingredients.map((i) => ({
          name: i.name,
          amount: i.amount,
          unit: i.unit,
          wasInStock: i.wasInStock,
          estPrice: i.estPrice ?? null,
        })),
      },
    },
    include: { ingredients: true },
  });
  return toRecipeDTO(recipe);
}

/** Null when missing *or* owned by someone else — IDs stay unprobeable. */
export async function updateRecipe(
  userId: string,
  id: string,
  data: { title?: string; isSaved?: boolean },
): Promise<RecipeDTO | null> {
  const { count } = await prisma.recipe.updateMany({ where: { id, userId }, data });
  if (count === 0) return null;
  return getRecipe(userId, id);
}

export async function deleteRecipe(
  userId: string,
  id: string,
): Promise<boolean> {
  const { count } = await prisma.recipe.deleteMany({ where: { id, userId } });
  return count > 0;
}

/** Generate a recipe from what is actually in stock (master plan §9.2). */
/**
 * Rough share of the daily target for a single main dish. Breakfast/lunch/
 * dinner/snack are not equal, but the recipe is not tied to a slot at
 * generation time, so a main-meal share is the honest default.
 */
const MEAL_SHARE = 0.3;

export async function generateRecipe(
  userId: string,
  wishes?: string,
): Promise<RecipeDTO> {
  const [inStockProducts, user] = await Promise.all([
    prisma.product.findMany({
      where: { userId, status: "IN_STOCK" },
      select: { name: true, quantity: true, unit: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { kcalTarget: true },
    }),
  ]);

  const generated = await runTask("generate_recipe", {
    inStock: inStockProducts.map(
      (p) => `${p.name} ${p.quantity.toString()} ${p.unit}`,
    ),
    wishes: wishes?.trim() || undefined,
    // Recipes now aim at the user's own target instead of ignoring it.
    targetKcal: user ? Math.round(user.kcalTarget * MEAL_SHARE) : undefined,
  });

  // Stored unsaved: an AI recipe only persists if the user keeps or schedules
  // it (Phase 6 garbage-collects the rest after 7 days).
  return createRecipe(userId, {
    title: generated.title,
    steps: generated.steps,
    calories: generated.calories,
    proteinG: generated.proteinG,
    fatG: generated.fatG,
    carbsG: generated.carbsG,
    cookTimeMin: generated.cookTimeMin,
    source: "AI",
    isSaved: false,
    ingredients: generated.ingredients.map((i) => ({
      name: i.name,
      amount: i.amount,
      unit: i.unit,
      wasInStock: i.wasInStock,
      estPrice: i.estPrice ?? null,
    })),
  });
}

export type MissingToShoppingResult = { added: number; alreadyListed: number };

/**
 * Push a recipe's missing ingredients onto the shopping list.
 * An ingredient already present as TO_BUY is left alone rather than
 * duplicated; one already IN_STOCK is not re-added either.
 */
export async function missingToShopping(
  userId: string,
  recipeId: string,
): Promise<MissingToShoppingResult | null> {
  const recipe = await getRecipe(userId, recipeId);
  if (!recipe) return null;

  const missing = recipe.ingredients.filter((i) => !i.wasInStock);
  if (missing.length === 0) return { added: 0, alreadyListed: 0 };

  const existing = await prisma.product.findMany({
    where: { userId },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((p) => normalizeName(p.name)));

  const toCreate = missing.filter(
    (i) => !existingNames.has(normalizeName(i.name)),
  );

  if (toCreate.length > 0) {
    await prisma.product.createMany({
      data: toCreate.map((i) => ({
        userId,
        name: i.name,
        category: "Другое",
        status: "TO_BUY" as const,
        quantity: i.amount,
        unit: i.unit,
        estPrice: i.estPrice,
      })),
    });
  }

  return {
    added: toCreate.length,
    alreadyListed: missing.length - toCreate.length,
  };
}
