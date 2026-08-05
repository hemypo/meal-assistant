import { z } from "zod";
import { auth } from "@/lib/auth";
import { budgetSchema, monthSchema } from "@/lib/validation/budget";
import { deleteBudget, listBudgets, upsertBudget } from "@/server/budgets";

const currentMonth = () => new Date().toISOString().slice(0, 7);

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const month = new URL(request.url).searchParams.get("month") ?? currentMonth();
  const parsed = monthSchema.safeParse(month);
  if (!parsed.success) {
    return Response.json({ error: "Некорректный месяц" }, { status: 400 });
  }

  return Response.json(await listBudgets(session.user.id, parsed.data));
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = budgetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  return Response.json(await upsertBudget(session.user.id, parsed.data));
}

const deleteSchema = z.object({
  month: monthSchema,
  category: z.string().max(60),
});

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const removed = await deleteBudget(
    session.user.id,
    parsed.data.month,
    parsed.data.category,
  );
  if (!removed) {
    return Response.json({ error: "Лимит не найден" }, { status: 404 });
  }

  return Response.json(await listBudgets(session.user.id, parsed.data.month));
}
