"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));

    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Не удалось зарегистрироваться");
      setPending(false);
      return;
    }

    // Registration succeeded — sign straight in so there's no second form.
    await signIn("credentials", { email, password, redirect: false });
    setPending(false);
    router.push("/inventory");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        autoFocus
      />
      <Field
        id="password"
        name="password"
        type="password"
        label="Пароль"
        autoComplete="new-password"
        placeholder="минимум 8 символов"
        minLength={8}
        required
        error={error}
      />
      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Создаём…" : "Зарегистрироваться"}
      </Button>
    </form>
  );
}
