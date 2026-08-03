import { afterEach, describe, expect, it, vi } from "vitest";
import { reportError } from "./observability";

const spy = vi.spyOn(console, "error").mockImplementation(() => {});
afterEach(() => spy.mockClear());

const logged = () => JSON.parse(spy.mock.calls[0][0] as string);

describe("error reporting", () => {
  it("emits a structured, filterable line", () => {
    reportError("ai", new Error("boom"), "generate_recipe");

    expect(logged()).toMatchObject({
      level: "error",
      scope: "ai",
      context: "generate_recipe",
      message: "boom",
    });
  });

  it("redacts a connection string that leaked into a message", () => {
    reportError(
      "route",
      new Error("connect failed postgresql://user:hunter2@db.neon.tech/x"),
    );

    const { message } = logged();
    expect(message).not.toContain("hunter2");
    expect(message).toContain("[connection-string]");
  });

  it("redacts api-key-shaped tokens", () => {
    reportError("ai", new Error("bad key AIzaSyA1234567890abcdefghijk"));

    expect(logged().message).not.toContain("AIzaSyA1234567890");
    expect(logged().message).toContain("[redacted]");
  });

  it("survives a non-Error being thrown", () => {
    reportError("cron", "just a string");

    expect(logged().message).toBe("non-error thrown");
  });
});
