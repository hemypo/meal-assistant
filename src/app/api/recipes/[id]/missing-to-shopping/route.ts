import { auth } from "@/lib/auth";
import { missingToShopping } from "@/server/recipes";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { id } = await params;
  const result = await missingToShopping(session.user.id, id);
  if (!result) {
    return Response.json({ error: "Рецепт не найден" }, { status: 404 });
  }

  return Response.json(result);
}
