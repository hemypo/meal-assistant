import { auth } from "@/lib/auth";
import { deleteExpense } from "@/server/analytics";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await deleteExpense(session.user.id, id))) {
    return Response.json({ error: "Расход не найден" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
