import { auth } from "@/lib/auth";
import { settingsSchema } from "@/lib/validation/settings";
import { getSettings, updateSettings } from "@/server/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const settings = await getSettings(session.user.id);
  if (!settings) {
    return Response.json({ error: "Профиль не найден" }, { status: 404 });
  }

  return Response.json(settings);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const settings = await updateSettings(session.user.id, parsed.data);
  if (!settings) {
    return Response.json({ error: "Профиль не найден" }, { status: 404 });
  }

  return Response.json(settings);
}
