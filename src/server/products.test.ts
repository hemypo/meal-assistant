import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  product: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = await import("./products");

const row = {
  id: "p1",
  name: "Молоко",
  category: "Молочное",
  status: "IN_STOCK" as const,
  quantity: "2.5",
  unit: "л",
  estPrice: "105",
};

beforeEach(() => vi.clearAllMocks());

describe("userId scoping", () => {
  it("listProducts filters by the caller's userId", async () => {
    prismaMock.product.findMany.mockResolvedValue([]);
    await listProducts("user-a", { status: "TO_BUY" });

    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-a", status: "TO_BUY" },
      }),
    );
  });

  it("createProduct always stamps the caller's userId", async () => {
    prismaMock.product.create.mockResolvedValue(row);
    await createProduct("user-a", {
      name: "Молоко",
      category: "Молочное",
      status: "IN_STOCK",
      quantity: 2.5,
      unit: "л",
      estPrice: 105,
    });

    expect(prismaMock.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-a" }),
    });
  });

  it("updateProduct returns null for another user's product", async () => {
    // updateMany matched nothing because the userId did not match.
    prismaMock.product.updateMany.mockResolvedValue({ count: 0 });

    const result = await updateProduct("user-b", "p1", { status: "TO_BUY" });

    expect(result).toBeNull();
    // Must not fall through to a lookup that could leak the row.
    expect(prismaMock.product.findUnique).not.toHaveBeenCalled();
  });

  it("deleteProduct refuses to delete another user's product", async () => {
    prismaMock.product.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteProduct("user-b", "p1")).resolves.toBe(false);
    expect(prismaMock.product.deleteMany).toHaveBeenCalledWith({
      where: { id: "p1", userId: "user-b" },
    });
  });
});

describe("status toggle", () => {
  it("persists the new status and returns the updated row", async () => {
    prismaMock.product.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.product.findUnique.mockResolvedValue({
      ...row,
      status: "TO_BUY",
    });

    const result = await updateProduct("user-a", "p1", { status: "TO_BUY" });

    expect(prismaMock.product.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", userId: "user-a" },
      data: { status: "TO_BUY" },
    });
    expect(result?.status).toBe("TO_BUY");
  });
});

describe("Decimal serialisation", () => {
  it("converts Decimal columns to numbers for the client", async () => {
    prismaMock.product.findMany.mockResolvedValue([row]);

    const [product] = await listProducts("user-a");

    expect(product.quantity).toBe(2.5);
    expect(product.estPrice).toBe(105);
  });

  it("keeps a missing price as null rather than 0", async () => {
    prismaMock.product.findMany.mockResolvedValue([{ ...row, estPrice: null }]);

    const [product] = await listProducts("user-a");

    expect(product.estPrice).toBeNull();
  });
});
