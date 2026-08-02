import { auth } from "@/lib/auth";
import { confirmReceipt } from "@/server/receipts";

type Params = { params: Promise<{ id: string }> };

const MESSAGES = {
  NOT_FOUND: "Чек не найден",
  NOT_DRAFT: "Чек уже подтверждён",
  EMPTY: "Пустой чек нельзя подтвердить",
} as const;

const STATUS = { NOT_FOUND: 404, NOT_DRAFT: 409, EMPTY: 422 } as const;

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await confirmReceipt(session.user.id, id);
    if (!result.ok) {
      return Response.json(
        { error: MESSAGES[result.reason] },
        { status: STATUS[result.reason] },
      );
    }
    return Response.json(result);
  } catch {
    // The transaction rolled back — inventory and expenses are untouched.
    console.error("[receipts] confirm transaction failed");
    return Response.json(
      { error: "Не удалось подтвердить чек — ничего не изменено" },
      { status: 500 },
    );
  }
}
