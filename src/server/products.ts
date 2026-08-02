import { prisma } from "@/lib/db";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "@/lib/validation/product";
import type { ProductStatus } from "@/generated/prisma/enums";

/** Shape sent to the client: Decimal columns become numbers. */
export type ProductDTO = {
  id: string;
  name: string;
  category: string;
  status: ProductStatus;
  quantity: number;
  unit: string;
  estPrice: number | null;
};

type ProductRow = {
  id: string;
  name: string;
  category: string;
  status: ProductStatus;
  quantity: { toString(): string };
  unit: string;
  estPrice: { toString(): string } | null;
};

function toDTO(p: ProductRow): ProductDTO {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    status: p.status,
    quantity: Number(p.quantity.toString()),
    estPrice: p.estPrice === null ? null : Number(p.estPrice.toString()),
    unit: p.unit,
  };
}

export async function listProducts(
  userId: string,
  filter: { status?: ProductStatus; category?: string } = {},
): Promise<ProductDTO[]> {
  const products = await prisma.product.findMany({
    where: { userId, ...filter },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return products.map(toDTO);
}

export async function createProduct(
  userId: string,
  input: CreateProductInput,
): Promise<ProductDTO> {
  const product = await prisma.product.create({
    data: { ...input, estPrice: input.estPrice ?? null, userId },
  });
  return toDTO(product);
}

/**
 * Returns null when the product does not exist *or* belongs to someone else —
 * the caller cannot tell the two apart, so IDs cannot be probed.
 */
export async function updateProduct(
  userId: string,
  id: string,
  input: UpdateProductInput,
): Promise<ProductDTO | null> {
  const { count } = await prisma.product.updateMany({
    where: { id, userId },
    data: input,
  });
  if (count === 0) return null;

  const product = await prisma.product.findUnique({ where: { id } });
  return product ? toDTO(product) : null;
}

export async function deleteProduct(
  userId: string,
  id: string,
): Promise<boolean> {
  const { count } = await prisma.product.deleteMany({ where: { id, userId } });
  return count > 0;
}
