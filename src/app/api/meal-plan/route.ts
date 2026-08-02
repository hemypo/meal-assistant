import { auth } from "@/lib/auth";
import {
  createMealEntrySchema,
  mealPlanRangeSchema,
} from "@/lib/validation/recipe";
import { addMealEntry, listMealPlan } from "@/server/mealplan";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = mealPlanRangeSchema.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!parsed.success) {
    return Response.json({ error: "Некорректный диапазон дат" }, { status: 400 });
  }

  return Response.json(
    await listMealPlan(session.user.id, parsed.data.from, parsed.data.to),
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = createMealEntrySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const entry = await addMealEntry(session.user.id, parsed.data);
  if (!entry) {
    return Response.json({ error: "Рецепт не найден" }, { status: 404 });
  }

  return Response.json(entry, { status: 201 });
}
