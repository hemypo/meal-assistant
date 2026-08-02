import { auth } from "@/lib/auth";
import { deleteMealEntry } from "@/server/mealplan";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await deleteMealEntry(session.user.id, id))) {
    return Response.json({ error: "Запись не найдена" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
