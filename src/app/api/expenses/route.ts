import { auth } from "@/lib/auth";
import { createExpenseSchema, rangeSchema } from "@/lib/validation/finance";
import { createExpense, listExpenses } from "@/server/analytics";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = rangeSchema.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!parsed.success) {
    return Response.json({ error: "Некорректный период" }, { status: 400 });
  }

  return Response.json(await listExpenses(session.user.id, parsed.data));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = createExpenseSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const expense = await createExpense(session.user.id, parsed.data);
  return Response.json(expense, { status: 201 });
}
