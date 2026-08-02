import { auth } from "@/lib/auth";
import { updateRecipeSchema } from "@/lib/validation/recipe";
import { deleteRecipe, updateRecipe } from "@/server/recipes";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = updateRecipeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const { id } = await params;
  const recipe = await updateRecipe(session.user.id, id, parsed.data);
  if (!recipe) {
    return Response.json({ error: "Рецепт не найден" }, { status: 404 });
  }

  return Response.json(recipe);
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await deleteRecipe(session.user.id, id))) {
    return Response.json({ error: "Рецепт не найден" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
