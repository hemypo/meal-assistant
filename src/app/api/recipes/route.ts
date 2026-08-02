import { auth } from "@/lib/auth";
import { createRecipeSchema } from "@/lib/validation/recipe";
import { createRecipe, listRecipes } from "@/server/recipes";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const onlySaved = searchParams.get("saved") === "true";

  return Response.json(await listRecipes(session.user.id, onlySaved));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = createRecipeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const recipe = await createRecipe(session.user.id, parsed.data);
  return Response.json(recipe, { status: 201 });
}
