import { auth } from "@/lib/auth";
import { rangeSchema } from "@/lib/validation/finance";
import { getSummary } from "@/server/analytics";

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

  return Response.json(await getSummary(session.user.id, parsed.data));
}
