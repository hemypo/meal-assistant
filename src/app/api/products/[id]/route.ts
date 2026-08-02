import { auth } from "@/lib/auth";
import { updateProductSchema } from "@/lib/validation/product";
import { deleteProduct, updateProduct } from "@/server/products";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const parsed = updateProductSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const product = await updateProduct(session.user.id, id, parsed.data);
  if (!product) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 });
  }

  return Response.json(product);
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await deleteProduct(session.user.id, id))) {
    return Response.json({ error: "Продукт не найден" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
