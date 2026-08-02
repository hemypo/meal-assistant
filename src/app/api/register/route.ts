import { credentialsSchema } from "@/lib/validation/auth";
import { registerUser } from "@/server/users";

const MESSAGES = {
  NOT_ALLOWED: "Регистрация закрыта: этот адрес не разрешён",
  ALREADY_EXISTS: "Пользователь с таким email уже зарегистрирован",
  NOT_CONFIGURED: "Регистрация не настроена",
} as const;

export async function POST(request: Request) {
  const parsed = credentialsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const result = await registerUser(parsed.data);
  if (!result.ok) {
    // 403 for a disallowed address, 409 for a duplicate.
    const status = result.error === "ALREADY_EXISTS" ? 409 : 403;
    return Response.json({ error: MESSAGES[result.error] }, { status });
  }

  return Response.json({ ok: true }, { status: 201 });
}
