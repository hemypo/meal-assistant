import { auth } from "@/lib/auth";
import {
  createProductSchema,
  listProductsSchema,
} from "@/lib/validation/product";
import { createProduct, listProducts } from "@/server/products";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = listProductsSchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    category: searchParams.get("category") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "Некорректный фильтр" }, { status: 400 });
  }

  return Response.json(await listProducts(session.user.id, parsed.data));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = createProductSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const product = await createProduct(session.user.id, parsed.data);
  return Response.json(product, { status: 201 });
}
