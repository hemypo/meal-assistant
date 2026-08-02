"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);

    const data = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(data.get("email")),
      password: String(data.get("password")),
      redirect: false,
    });

    setPending(false);
    if (result?.error) {
      setError("Неверный email или пароль");
      return;
    }
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
        autoComplete="current-password"
        placeholder="••••••••"
        required
        error={error}
      />
      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Входим…" : "Войти"}
      </Button>
    </form>
  );
}
