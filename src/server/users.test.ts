import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  user: { findUnique: vi.fn(), create: vi.fn() },
};

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@node-rs/argon2", () => ({ hash: vi.fn(async () => "hashed") }));

const { registerUser } = await import("./users");

const input = { email: "allowed@example.com", password: "correct-horse" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ALLOWED_EMAIL = "allowed@example.com";
});

describe("registration lock (CLAUDE.md §5)", () => {
  it("rejects any address other than ALLOWED_EMAIL", async () => {
    const result = await registerUser({ ...input, email: "someone@else.com" });

    expect(result).toEqual({ ok: false, error: "NOT_ALLOWED" });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("accepts the allowed address and stores a hash, never the password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "u1" });

    const result = await registerUser(input);

    expect(result).toEqual({ ok: true });
    const { data } = prismaMock.user.create.mock.calls[0][0];
    expect(data.passwordHash).toBe("hashed");
    expect(JSON.stringify(data)).not.toContain(input.password);
  });

  it("refuses a second registration for the same address", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1" });

    const result = await registerUser(input);

    expect(result).toEqual({ ok: false, error: "ALREADY_EXISTS" });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("fails closed when ALLOWED_EMAIL is not configured", async () => {
    delete process.env.ALLOWED_EMAIL;

    const result = await registerUser(input);

    expect(result).toEqual({ ok: false, error: "NOT_CONFIGURED" });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("matches ALLOWED_EMAIL case-insensitively", async () => {
    process.env.ALLOWED_EMAIL = "  Allowed@Example.com  ";
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "u1" });

    await expect(registerUser(input)).resolves.toEqual({ ok: true });
  });
});
