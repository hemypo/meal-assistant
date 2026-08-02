import { auth } from "@/lib/auth";
import { createWeightSchema, rangeSchema } from "@/lib/validation/finance";
import { getWeightOverview, upsertWeight } from "@/server/weight";

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

  return Response.json(await getWeightOverview(session.user.id, parsed.data));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = createWeightSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const entry = await upsertWeight(session.user.id, parsed.data);
  return Response.json(entry, { status: 201 });
}
