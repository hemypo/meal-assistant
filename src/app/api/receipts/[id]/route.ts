import { auth } from "@/lib/auth";
import { updateReceiptSchema } from "@/lib/validation/receipt";
import { discardReceipt, updateDraftReceipt } from "@/server/receipts";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = updateReceiptSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const result = await updateDraftReceipt(session.user.id, id, parsed.data);

  if (result === null) {
    return Response.json({ error: "Чек не найден" }, { status: 404 });
  }
  if (result === "NOT_DRAFT") {
    return Response.json(
      { error: "Подтверждённый чек нельзя изменить" },
      { status: 409 },
    );
  }

  return Response.json(result);
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { id } = await params;
  const result = await discardReceipt(session.user.id, id);

  if (result === false) {
    return Response.json({ error: "Чек не найден" }, { status: 404 });
  }
  if (result === "NOT_DRAFT") {
    return Response.json(
      { error: "Подтверждённый чек нельзя удалить" },
      { status: 409 },
    );
  }

  return new Response(null, { status: 204 });
}
